import type { ModelCostEntry } from '~~/app/types/stats'

interface ModelsResponse {
  models: ModelCostEntry[]
  cacheSavings: {
    actualCost: number
    uncachedCost: number
    saved: number
    savingsPercent: number
  }
}

export default defineEventHandler(async (): Promise<ModelsResponse> => {
  await syncSessionDb()
  const sessions = queryAllSessions()
  const subType = await getSubscriptionType()
  const apiCosts = subType === 'api' ? queryApiDailyCosts() : []

  // Aggregate tokens per model from all sessions
  const modelAgg = new Map<string, {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }>()

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
  }

  // Aggregate API costs by model for authoritative cost replacement
  const apiCostByModel = new Map<string, number>()
  for (const row of apiCosts) {
    apiCostByModel.set(row.model, (apiCostByModel.get(row.model) ?? 0) + row.cost)
  }
  const hasApiCosts = apiCostByModel.size > 0

  let totalActualCost = 0
  let totalUncachedCost = 0

  const models: ModelCostEntry[] = Array.from(modelAgg.entries()).map(([model, tokens]) => {
    const costResult = calculateCost(model, tokens)
    const uncached = calculateUncachedCost(model, tokens)

    // Use API cost for this model if available, otherwise JSONL-calculated
    const actualCost = hasApiCosts
      ? (apiCostByModel.get(model) ?? costResult.totalCost)
      : costResult.totalCost

    totalActualCost += actualCost
    totalUncachedCost += uncached

    const totalTokens = tokens.inputTokens + tokens.outputTokens
      + tokens.cacheReadTokens + tokens.cacheWriteTokens

    return {
      model,
      ...tokens,
      ...costResult,
      totalCost: actualCost,
      totalTokens,
    }
  })

  const saved = totalUncachedCost - totalActualCost

  return {
    models,
    cacheSavings: {
      actualCost: totalActualCost,
      uncachedCost: totalUncachedCost,
      saved,
      savingsPercent: totalUncachedCost > 0 ? (saved / totalUncachedCost) * 100 : 0,
    },
  }
})
