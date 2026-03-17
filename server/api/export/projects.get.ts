export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const format = String(query.format || 'csv')
  const from = query.from ? String(query.from) : undefined
  const to = query.to ? String(query.to) : undefined

  await syncSessionDb()
  const sessions = queryAllSessions({ from, to })

  const projectMap = new Map<string, {
    path: string
    sessionCount: number
    messageCount: number
    totalTokens: number
    totalCost: number
    lastActive: string
    models: Set<string>
  }>()

  for (const session of sessions) {
    const name = session.project || 'Unknown'
    const sessionTokens = session.inputTokens + session.outputTokens
      + session.cacheReadTokens + session.cacheWriteTokens
    const existing = projectMap.get(name)

    if (existing) {
      existing.sessionCount++
      existing.messageCount += session.messageCount
      existing.totalTokens += sessionTokens
      existing.totalCost += session.totalCost
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
        totalCost: session.totalCost,
        lastActive: session.startTime,
        models: new Set(session.model ? [session.model] : []),
      })
    }
  }

  const rows = Array.from(projectMap.entries())
    .map(([name, data]) => ({
      project: name,
      path: data.path,
      sessions: data.sessionCount,
      messages: data.messageCount,
      totalTokens: data.totalTokens,
      totalCost: data.totalCost,
      lastActive: data.lastActive,
      models: Array.from(data.models).join('; '),
    }))
    .sort((a, b) => b.totalCost - a.totalCost)

  const filename = `projects-export-${new Date().toISOString().slice(0, 10)}`

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.json"`)
    return rows
  }

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.csv"`)
  return toCsv(rows)
})
