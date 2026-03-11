import type { NotificationSettings, NotificationRecord } from '~~/app/types/notifications'
import { NOTIFICATION_DEFAULTS } from '~~/app/types/notifications'

export function getNotificationSettings(): NotificationSettings {
  const db = getDb()
  const row = db.prepare('SELECT value FROM notification_settings WHERE key = ?').get('settings') as { value: string } | undefined
  if (!row) return { ...NOTIFICATION_DEFAULTS }
  try {
    const saved = JSON.parse(row.value)
    return {
      ...NOTIFICATION_DEFAULTS,
      ...saved,
      thresholds: {
        ...NOTIFICATION_DEFAULTS.thresholds,
        ...saved.thresholds,
        fiveHour: { ...NOTIFICATION_DEFAULTS.thresholds.fiveHour, ...saved.thresholds?.fiveHour },
        sevenDay: { ...NOTIFICATION_DEFAULTS.thresholds.sevenDay, ...saved.thresholds?.sevenDay },
        sevenDaySonnet: { ...NOTIFICATION_DEFAULTS.thresholds.sevenDaySonnet, ...saved.thresholds?.sevenDaySonnet },
      },
      paceAlerts: {
        ...NOTIFICATION_DEFAULTS.paceAlerts,
        ...saved.paceAlerts,
        windows: { ...NOTIFICATION_DEFAULTS.paceAlerts.windows, ...saved.paceAlerts?.windows },
      },
      quietHours: { ...NOTIFICATION_DEFAULTS.quietHours, ...saved.quietHours },
      whatsapp: { ...NOTIFICATION_DEFAULTS.whatsapp, ...saved.whatsapp },
    }
  } catch {
    return { ...NOTIFICATION_DEFAULTS }
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  const db = getDb()
  db.prepare(
    'INSERT INTO notification_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run('settings', JSON.stringify(settings))
}

export function insertNotification(record: {
  type: string
  windowType: string | null
  thresholdLevel: number | null
  title: string
  body: string
  utilization: number | null
}): number {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO notification_history (type, window_type, threshold_level, title, body, utilization)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(record.type, record.windowType, record.thresholdLevel, record.title, record.body, record.utilization)
  return Number(result.lastInsertRowid)
}

export function getNotificationHistory(limit = 50): NotificationRecord[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT id, type, window_type as windowType, threshold_level as thresholdLevel,
           title, body, utilization, created_at as createdAt, read
    FROM notification_history
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<Omit<NotificationRecord, 'read'> & { read: number }>
  return rows.map(r => ({ ...r, read: !!r.read }))
}

export function markNotificationRead(id: number): void {
  const db = getDb()
  db.prepare('UPDATE notification_history SET read = 1 WHERE id = ?').run(id)
}

export function markAllNotificationsRead(): void {
  const db = getDb()
  db.prepare('UPDATE notification_history SET read = 1 WHERE read = 0').run()
}

export function getUnreadNotificationCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM notification_history WHERE read = 0').get() as { count: number }
  return row.count
}
