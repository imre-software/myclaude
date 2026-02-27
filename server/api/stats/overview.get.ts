import type { ModelCostEntry, OverviewResponse } from '~~/app/types/stats'

export default defineEventHandler(async (): Promise<OverviewResponse> => {
  await syncSessionDb()
  const stats = await parseStatsCache()
  const sessions = queryAllSessions()
  const subType = await getSubscriptionType()
  const apiCosts = subType === 'api' ? queryApiDailyCosts() : []

  // Build model breakdown from session data (includes all sessions, not just stats-cache)
  const modelAgg = new Map<string, {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }>()

  let totalMessages = 0
  let firstDate = ''

  for (const session of sessions) {
    const model = session.model || 'unknown'
    const existing = modelAgg.get(model) ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    }
    existing.inputTokens += session.inputTokens
    existing.outputTokens += session.outputTokens
    existing.cacheReadTokens += session.cacheReadTokens
    existing.cacheWriteTokens += session.cacheWriteTokens
    modelAgg.set(model, existing)

    totalMessages += session.messageCount

    if (session.startTime && (!firstDate || session.startTime < firstDate)) {
      firstDate = session.startTime
    }
  }

  const modelBreakdown: ModelCostEntry[] = Array.from(modelAgg.entries()).map(([model, tokens]) => {
    const costResult = calculateCost(model, tokens)
    const totalTokens = tokens.inputTokens + tokens.outputTokens
      + tokens.cacheReadTokens + tokens.cacheWriteTokens

    return {
      model,
      ...tokens,
      ...costResult,
      totalTokens,
    }
  })

  const totalTokens = modelBreakdown.reduce((sum, m) => sum + m.totalTokens, 0)
  const jsonlTotalCost = modelBreakdown.reduce((sum, m) => sum + m.totalCost, 0)

  // Use API costs as authoritative total when available
  const apiTotalCost = apiCosts.reduce((sum, row) => sum + row.cost, 0)
  const totalCost = apiTotalCost > 0 ? apiTotalCost : jsonlTotalCost

  return {
    totalTokens,
    totalCost,
    totalSessions: sessions.length,
    totalMessages,
    firstSessionDate: firstDate || stats.firstSessionDate,
    lastComputedDate: new Date().toISOString().slice(0, 10),
    modelBreakdown,
  }
})
