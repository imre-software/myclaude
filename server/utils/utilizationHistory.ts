interface UtilizationSnapshot {
  utilization: number
  resetsAt: string | null
  recordedAt: string
}

export function recordUtilization(windowType: string, utilization: number, resetsAt: string | null): void {
  const db = getDb()
  db.prepare(
    'INSERT INTO utilization_history (window_type, utilization, resets_at) VALUES (?, ?, ?)',
  ).run(windowType, utilization, resetsAt)

  // Prune rows older than 60 minutes
  db.prepare(
    "DELETE FROM utilization_history WHERE window_type = ? AND recorded_at < datetime('now', 'localtime', '-60 minutes')",
  ).run(windowType)
}

export function clearUtilizationHistory(): void {
  const db = getDb()
  db.prepare('DELETE FROM utilization_history').run()
}

export function getUtilizationHistory(windowType: string, limit = 30): UtilizationSnapshot[] {
  const db = getDb()
  return db.prepare(`
    SELECT utilization, resets_at AS resetsAt, recorded_at AS recordedAt
    FROM utilization_history
    WHERE window_type = ?
    ORDER BY recorded_at ASC
    LIMIT ?
  `).all(windowType, limit) as UtilizationSnapshot[]
}
