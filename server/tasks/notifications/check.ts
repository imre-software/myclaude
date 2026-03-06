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

    // Pace alerts
    if (settings.paceAlerts.enabled) {
      const paceWindows: Array<{ key: string, label: string, data: { utilization: number, resetsAt: string | null } | null }> = [
        { key: 'fiveHour', label: '5-hour', data: rateLimits.fiveHour },
        { key: 'sevenDay', label: '7-day (all models)', data: rateLimits.sevenDay },
        { key: 'sevenDaySonnet', label: '7-day (Sonnet)', data: rateLimits.sevenDaySonnet },
        { key: 'sevenDayOpus', label: '7-day (Opus)', data: rateLimits.sevenDayOpus },
      ]

      for (const { key, label, data } of paceWindows) {
        if (!data) continue

        const history = getUtilizationHistory(key)
        const pace = calculatePace(history, data.utilization, data.resetsAt)

        if (pace.willExhaust && pace.exhaustsInHours !== null && pace.resetsInHours !== null) {
          const debounceKey = `pace:${key}`
          const entry = debounce[debounceKey]
          const cooldownMs = settings.cooldownMinutes * 60_000
          const withinCooldown = entry && (Date.now() - entry.lastFiredAt) < cooldownMs

          if (!withinCooldown) {
            const exhaustLabel = pace.exhaustsInHours < 1
              ? `${Math.round(pace.exhaustsInHours * 60)}min`
              : `${pace.exhaustsInHours.toFixed(1)}h`
            const resetLabel = pace.resetsInHours < 1
              ? `${Math.round(pace.resetsInHours * 60)}min`
              : `${pace.resetsInHours.toFixed(1)}h`
            const title = `${label} pace alert`
            const body = `At current rate, exhausts in ~${exhaustLabel} (resets in ${resetLabel})`

            pending.push({ type: 'pace', windowType: key, level: 0, utilization: data.utilization, title, body })

            debounce[debounceKey] = {
              lastFiredAt: Date.now(),
              lastUtilization: data.utilization,
            }
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
