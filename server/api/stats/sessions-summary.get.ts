interface SessionsSummaryResponse {
  totalSessions: number
  totalCost: number
  avgCost: number
  avgDuration: number
}

export default defineEventHandler(async (event): Promise<SessionsSummaryResponse> => {
  await syncSessionDb()

  const query = getQuery(event)
  const from = typeof query.from === 'string' ? query.from : undefined
  const to = typeof query.to === 'string' ? query.to : undefined

  const db = getDb()

  // Session counts and duration from sessions table (start_time based)
  const sessionConditions = ['message_count >= 2']
  const sessionParams: string[] = []
  if (from) {
    sessionConditions.push("strftime('%Y-%m-%d', start_time, 'localtime') >= ?")
    sessionParams.push(from)
  }
  if (to) {
    sessionConditions.push("strftime('%Y-%m-%d', start_time, 'localtime') <= ?")
    sessionParams.push(to)
  }
  const sessionWhere = sessionConditions.join(' AND ')

  const sessionRow = db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      COALESCE(AVG(duration), 0) as avg_duration
    FROM sessions
    WHERE ${sessionWhere}
  `).get(...sessionParams) as {
    total_sessions: number
    avg_duration: number
  }

  // Cost from file_daily_costs (message-timestamp based, same source as overview)
  const costConditions: string[] = []
  const costParams: string[] = []
  if (from) {
    costConditions.push('date >= ?')
    costParams.push(from)
  }
  if (to) {
    costConditions.push('date <= ?')
    costParams.push(to)
  }
  const costWhere = costConditions.length > 0
    ? 'WHERE ' + costConditions.join(' AND ')
    : ''

  const costRow = db.prepare(`
    SELECT COALESCE(SUM(cost), 0) as total_cost
    FROM file_daily_costs
    ${costWhere}
  `).get(...costParams) as { total_cost: number }

  const totalCost = costRow.total_cost
  const totalSessions = sessionRow.total_sessions
  const avgCost = totalSessions > 0 ? totalCost / totalSessions : 0

  return {
    totalSessions,
    totalCost,
    avgCost,
    avgDuration: sessionRow.avg_duration,
  }
})
