export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const format = String(query.format || 'csv')
  const from = query.from ? String(query.from) : undefined
  const to = query.to ? String(query.to) : undefined

  const sessions = queryAllSessions({ from, to })

  const rows = sessions.map(s => ({
    sessionId: s.sessionId,
    project: s.project,
    startTime: s.startTime,
    model: s.model,
    messageCount: s.messageCount,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    cacheReadTokens: s.cacheReadTokens,
    cacheWriteTokens: s.cacheWriteTokens,
    totalCost: s.totalCost,
    duration: s.duration,
  }))

  const filename = `sessions-export-${new Date().toISOString().slice(0, 10)}`

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.json"`)
    return rows
  }

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.csv"`)
  return toCsv(rows)
})
