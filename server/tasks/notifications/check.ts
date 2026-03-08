import type { NotificationWindowType } from '~~/app/types/notifications'

interface DebounceState {
  [key: string]: { lastFiredAt: number, lastUtilization: number }
}

const WINDOW_LABELS: Record<NotificationWindowType, string> = {
  fiveHour: '5-hour',
  sevenDay: '7-day (all models)',
  sevenDaySonnet: '7-day (Sonnet)',
}

function getDebounceState(): DebounceState {
  const db = getDb()
  const row = db.prepare('SELECT value FROM notification_settings WHERE key = ?').get('debounce') as { value: string } | undefined
  if (!row) return {}
  try {
    return JSON.parse(row.value)
  } catch {
    return {}
  }
}

function saveDebounceState(state: DebounceState): void {
  const db = getDb()
  db.prepare(
    'INSERT INTO notification_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run('debounce', JSON.stringify(state))
}

export default defineTask({
  meta: {
    name: 'notifications:check',
    description: 'Check rate limits against notification thresholds and record utilization snapshots',
  },
  async run() {
    // Cron runs hourly - fetch fresh data from the API each time
    const rateLimits = await fetchRateLimits()

    // Push utilization to SSE so tray updates even when window is hidden
    if (rateLimits) {
      pushNotificationEvent({
        type: 'usage-update',
        fiveHour: rateLimits.fiveHour?.utilization ?? null,
        sevenDay: rateLimits.sevenDay?.utilization ?? null,
        sevenDaySonnet: rateLimits.sevenDaySonnet?.utilization ?? null,
      })
    }

    // Always record snapshots when rate limits are available, regardless of notification settings
    if (rateLimits) {
      const allWindows: Array<{ key: string, data: { utilization: number, resetsAt: string | null } | null }> = [
        { key: 'fiveHour', data: rateLimits.fiveHour },
        { key: 'sevenDay', data: rateLimits.sevenDay },
        { key: 'sevenDaySonnet', data: rateLimits.sevenDaySonnet },
        { key: 'sevenDayOpus', data: rateLimits.sevenDayOpus },
      ]

      for (const { key, data } of allWindows) {
        if (data) {
          recordUtilization(key, data.utilization, data.resetsAt)
        }
      }
    }

    // Alert logic requires both settings enabled and rate limits
    const settings = getNotificationSettings()
    if (!settings.enabled || !rateLimits) {
      return { result: rateLimits ? 'alerts-disabled' : 'no-rate-limits' }
    }

    const debounce = getDebounceState()
    const pending: Array<{ type: string, windowType: string, level: number, utilization: number, title: string, body: string }> = []

    const windowMap: Array<{ key: NotificationWindowType, data: { utilization: number, resetsAt: string | null } | null }> = [
      { key: 'fiveHour', data: rateLimits.fiveHour },
      { key: 'sevenDay', data: rateLimits.sevenDay },
      { key: 'sevenDaySonnet', data: rateLimits.sevenDaySonnet },
    ]

    for (const { key, data } of windowMap) {
      if (!data) continue

      const config = settings.thresholds[key]
      if (!config.enabled) continue

      for (const level of config.levels) {
        const debounceKey = `${key}:${level}`
        const entry = debounce[debounceKey]

        if (data.utilization >= level) {
          const cooldownMs = settings.cooldownMinutes * 60_000
          const withinCooldown = entry && (Date.now() - entry.lastFiredAt) < cooldownMs
          const hasNotDroppedBelow = entry && entry.lastUtilization >= level

          if (!withinCooldown && !hasNotDroppedBelow) {
            const windowLabel = WINDOW_LABELS[key]
            const title = `${windowLabel} limit at ${Math.round(data.utilization)}%`
            const body = `Usage crossed the ${level}% threshold for your ${windowLabel} window.`

            pending.push({ type: 'threshold', windowType: key, level, utilization: data.utilization, title, body })

            debounce[debounceKey] = {
              lastFiredAt: Date.now(),
              lastUtilization: data.utilization,
            }
          }
        }

        // Track current utilization for drop-below detection
        debounce[debounceKey] = {
          lastFiredAt: debounce[debounceKey]?.lastFiredAt ?? 0,
          lastUtilization: data.utilization,
        }
      }
    }

    // Pace alerts - fire when projected usage at reset exceeds configured levels
    if (settings.paceAlerts.enabled && settings.paceAlerts.levels.length > 0) {
      const paceWindowMap: Record<string, string> = {
        fiveHour: '5-hour',
        sevenDay: '7-day (all models)',
        sevenDaySonnet: '7-day (Sonnet)',
      }
      const paceWindowData: Record<string, { utilization: number, resetsAt: string | null } | null> = {
        fiveHour: rateLimits.fiveHour,
        sevenDay: rateLimits.sevenDay,
        sevenDaySonnet: rateLimits.sevenDaySonnet,
      }

      for (const [key, label] of Object.entries(paceWindowMap)) {
        if (!settings.paceAlerts.windows[key as NotificationWindowType]) continue
        const data = paceWindowData[key]
        if (!data) continue

        const pace = calculatePace(key, data.utilization, data.resetsAt)
        const projected = Math.round(pace.projectedAtReset)

        for (const level of settings.paceAlerts.levels) {
          if (projected < level) continue

          const debounceKey = `pace:${key}:${level}`
          const entry = debounce[debounceKey]
          const cooldownMs = settings.cooldownMinutes * 60_000
          const withinCooldown = entry && (Date.now() - entry.lastFiredAt) < cooldownMs
          const hasNotDroppedBelow = entry && entry.lastUtilization >= level

          if (!withinCooldown && !hasNotDroppedBelow) {
            const title = `${label} - on pace for ${projected}%`
            const body = level >= 100
              ? `At current rate, you'll exhaust this limit before it resets.`
              : `At current rate, you'll use ${projected}% of your ${label} limit by reset.`

            pending.push({ type: 'pace', windowType: key, level, utilization: data.utilization, title, body })

            debounce[debounceKey] = {
              lastFiredAt: Date.now(),
              lastUtilization: projected,
            }
          }

          debounce[debounceKey] = {
            lastFiredAt: debounce[debounceKey]?.lastFiredAt ?? 0,
            lastUtilization: projected,
          }
        }
      }
    }

    saveDebounceState(debounce)

    // Log pending notifications and push to SSE subscribers
    for (const n of pending) {
      insertNotification({
        type: n.type,
        windowType: n.windowType,
        thresholdLevel: n.level,
        title: n.title,
        body: n.body,
        utilization: n.utilization,
      })
      pushNotificationEvent(n)
    }

    return { result: `checked, ${pending.length} notifications fired` }
  },
})
