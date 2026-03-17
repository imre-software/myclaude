export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const format = String(query.format || 'csv')

  await syncSessionDb()
  const sessions = queryAllSessions()

  const modelAgg = new Map<string, {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    sessions: number
  }>()

  for (const session of sessions) {
    const model = session.model || 'unknown'
    const existing = modelAgg.get(model) ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      sessions: 0,
    }
    existing.inputTokens += session.inputTokens
    existing.outputTokens += session.outputTokens
    existing.cacheReadTokens += session.cacheReadTokens
    existing.cacheWriteTokens += session.cacheWriteTokens
    existing.sessions++
    modelAgg.set(model, existing)
  }

  const rows = Array.from(modelAgg.entries()).map(([model, tokens]) => {
    const cost = calculateCost(model, tokens)
    return {
      model,
      sessions: tokens.sessions,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cacheReadTokens: tokens.cacheReadTokens,
      cacheWriteTokens: tokens.cacheWriteTokens,
      inputCost: cost.inputCost,
      outputCost: cost.outputCost,
      cacheReadCost: cost.cacheReadCost,
      cacheWriteCost: cost.cacheWriteCost,
      totalCost: cost.totalCost,
    }
  })

  rows.sort((a, b) => b.totalCost - a.totalCost)

  const filename = `costs-export-${new Date().toISOString().slice(0, 10)}`

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.json"`)
    return rows
  }

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.csv"`)
  return toCsv(rows)
})
