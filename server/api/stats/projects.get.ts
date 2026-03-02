import type { ProjectStats } from '~~/app/types/stats'

export default defineEventHandler(async (event): Promise<ProjectStats[]> => {
  await syncSessionDb()
  const query = getQuery(event)
  const from = typeof query.from === 'string' ? query.from : undefined
  const to = typeof query.to === 'string' ? query.to : undefined
  const db = getDb()

  // Build date conditions for file_daily_costs (message-timestamp-based, same as overview)
  const costConditions: string[] = []
  const costParams: string[] = []
  if (from) {
    costConditions.push('fdc.date >= ?')
    costParams.push(from)
  }
  if (to) {
    costConditions.push('fdc.date <= ?')
    costParams.push(to)
  }
  const costWhere = costConditions.length > 0
    ? 'WHERE ' + costConditions.join(' AND ')
    : ''

  // Get per-project costs from file_daily_costs joined with sessions (same source as overview)
  const costRows = db.prepare(`
    SELECT s.project, SUM(fdc.cost) as total_cost
    FROM file_daily_costs fdc
    JOIN sessions s ON fdc.file_path = s.file_path
    ${costWhere}
    GROUP BY s.project
  `).all(...costParams) as { project: string, total_cost: number }[]

  const costByProject = new Map(costRows.map(r => [r.project, r.total_cost]))

  // Get session data (counts, tokens, models) using session start_time for date filtering
  const sessions = queryAllSessions({ from, to })

  // Group sessions by project
  const projectMap = new Map<string, {
    path: string
    sessionCount: number
    messageCount: number
    totalTokens: number
    lastActive: string
    models: Set<string>
  }>()

  for (const session of sessions) {
    const name = session.project || 'Unknown'
    const existing = projectMap.get(name)

    const sessionTokens = session.inputTokens + session.outputTokens
      + session.cacheReadTokens + session.cacheWriteTokens

    if (existing) {
      existing.sessionCount++
      existing.messageCount += session.messageCount
      existing.totalTokens += sessionTokens
      if (session.startTime > existing.lastActive) {
        existing.lastActive = session.startTime
      }
      if (session.model) existing.models.add(session.model)
    } else {
      projectMap.set(name, {
        path: session.projectPath,
        sessionCount: 1,
        messageCount: session.messageCount,
        totalTokens: sessionTokens,
        lastActive: session.startTime,
        models: new Set(session.model ? [session.model] : []),
      })
    }
  }

  const projects: ProjectStats[] = Array.from(projectMap.entries()).map(([name, data]) => ({
    name,
    path: data.path,
    sessionCount: data.sessionCount,
    messageCount: data.messageCount,
    totalTokens: data.totalTokens,
    totalCost: costByProject.get(name) ?? 0,
    lastActive: data.lastActive,
    models: Array.from(data.models),
  }))

  // Sort by total cost descending
  projects.sort((a, b) => b.totalCost - a.totalCost)

  return projects
})
