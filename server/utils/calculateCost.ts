interface TokenCounts {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

interface CostBreakdown {
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  totalCost: number
}

export function calculateCost(model: string, tokens: TokenCounts): CostBreakdown {
  const pricing = getModelPricing(model)
  const million = 1_000_000

  const inputCost = (tokens.inputTokens / million) * pricing.input
  const outputCost = (tokens.outputTokens / million) * pricing.output
  const cacheReadCost = (tokens.cacheReadTokens / million) * pricing.cacheRead
  const cacheWriteCost = (tokens.cacheWriteTokens / million) * pricing.cacheWrite

  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost: inputCost + outputCost + cacheReadCost + cacheWriteCost,
  }
}

export function calculateUncachedCost(model: string, tokens: TokenCounts): number {
  const pricing = getModelPricing(model)
  const million = 1_000_000

  // If there was no caching, all cache tokens would have been regular input tokens
  const totalInput = tokens.inputTokens + tokens.cacheReadTokens + tokens.cacheWriteTokens
  const inputCost = (totalInput / million) * pricing.input
  const outputCost = (tokens.outputTokens / million) * pricing.output

  return inputCost + outputCost
}
