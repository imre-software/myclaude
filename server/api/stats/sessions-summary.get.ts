interface SessionsSummaryResponse {
  totalSessions: number
  totalCost: number
  avgCost: number
  avgDuration: number
}

export default defineEventHandler(async (): Promise<SessionsSummaryResponse> => {
  await syncSessionDb()

  const db = getDb()
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(AVG(total_cost), 0) as avg_cost,
      COALESCE(AVG(duration), 0) as avg_duration
    FROM sessions
    WHERE message_count >= 2
  `).get() as {
    total_sessions: number
    total_cost: number
    avg_cost: number
    avg_duration: number
  }

  return {
    totalSessions: row.total_sessions,
    totalCost: row.total_cost,
    avgCost: row.avg_cost,
    avgDuration: row.avg_duration,
  }
})
