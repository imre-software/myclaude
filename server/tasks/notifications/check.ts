import type { NotificationWindowType } from '~~/app/types/notifications'
import type { RateLimitInfo } from '~~/app/types/usage'

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
    description: 'Check rate limits against notification thresholds',
  },
  async run() {
    const settings = getNotificationSettings()
    if (!settings.enabled) return { result: 'disabled' }

    const rateLimits = await fetchRateLimits()
    if (!rateLimits) return { result: 'no-data' }

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
