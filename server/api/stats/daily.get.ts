import type { DailyActivityEntry } from '~~/app/types/stats'

export default defineEventHandler(async (): Promise<DailyActivityEntry[]> => {
  await syncSessionDb()
  const stats = await parseStatsCache()
  const dailyCosts = queryDailyCosts()
  const subType = await getSubscriptionType()
  const apiCosts = subType === 'api' ? queryApiDailyCosts() : []
  const dailyActivity = queryDailyActivity()
  const dbTokensByModel = queryDailyTokensByModel()

  // Build a map of DB-derived daily activity (sessions, messages, tokens)
  const dbActivityByDate = new Map<string, { sessionCount: number, messageCount: number, totalTokens: number }>()
  for (const entry of dailyActivity) {
    dbActivityByDate.set(entry.date, {
      sessionCount: entry.sessionCount,
      messageCount: entry.messageCount,
      totalTokens: entry.totalTokens,
    })
  }

  // Build a map of stats-cache daily activity for toolCallCount (not in DB)
  const cacheActivityByDate = new Map<string, { toolCallCount: number }>()
  for (const entry of stats.dailyActivity) {
    cacheActivityByDate.set(entry.date, {
      toolCallCount: entry.toolCallCount,
    })
  }

  // Build a map of daily costs by date (JSONL-based)
  const costsByDate = new Map<string, { costByModel: Record<string, number>, totalCost: number }>()
  for (const entry of dailyCosts) {
    costsByDate.set(entry.date, { costByModel: entry.costByModel, totalCost: entry.totalCost })
  }

  // Overlay API costs - they are authoritative and replace JSONL costs for matching dates
  const apiCostsByDate = new Map<string, Map<string, number>>()
  for (const row of apiCosts) {
    let modelMap = apiCostsByDate.get(row.date)
    if (!modelMap) {
      modelMap = new Map()
      apiCostsByDate.set(row.date, modelMap)
    }
    modelMap.set(row.model, (modelMap.get(row.model) ?? 0) + row.cost)
  }
  for (const [date, modelMap] of apiCostsByDate) {
    const costByModel = Object.fromEntries(modelMap)
    const totalCost = Array.from(modelMap.values()).reduce((sum, c) => sum + c, 0)
    costsByDate.set(date, { costByModel, totalCost })
  }

  // Collect all unique dates from all sources
  const allDates = new Set<string>()
  for (const date of dbActivityByDate.keys()) allDates.add(date)
  for (const date of cacheActivityByDate.keys()) allDates.add(date)
  for (const date of costsByDate.keys()) allDates.add(date)

  // Build daily entries for all dates, sorted chronologically
  const result: DailyActivityEntry[] = Array.from(allDates)
    .sort()
    .map((date) => {
      const dbActivity = dbActivityByDate.get(date)
      const cacheActivity = cacheActivityByDate.get(date)
      const costs = costsByDate.get(date)

      // Token breakdown by model: prefer stats-cache, fall back to DB sessions
      const cacheTokens = stats.dailyModelTokens.find(d => d.date === date)?.tokensByModel
      const tokensByModel = (cacheTokens && Object.keys(cacheTokens).length > 0)
        ? cacheTokens
        : (dbTokensByModel.get(date) ?? {})
      const totalTokens = dbActivity?.totalTokens
        ?? Object.values(tokensByModel).reduce((sum, t) => sum + t, 0)

      return {
        date,
        messageCount: dbActivity?.messageCount ?? 0,
        sessionCount: dbActivity?.sessionCount ?? 0,
        toolCallCount: cacheActivity?.toolCallCount ?? 0,
        tokensByModel,
        totalTokens,
        costByModel: costs?.costByModel ?? {},
        totalCost: costs?.totalCost ?? 0,
      }
    })

  return result
})
