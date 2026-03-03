import type { UsageResponse } from '~~/app/types/usage'
import { clearContextCache, getCachedContext, probeContext } from '~~/server/utils/contextProbe'

const emptyContext = {
  model: '',
  totalContextWindow: 200_000,
  usedTokens: 0,
  usedPercentage: 0,
  categories: [],
  freeSpace: 0,
  freeSpacePercentage: 0,
  autocompactBuffer: 0,
  autocompactPercentage: 0,
} as const

export default defineEventHandler(async (event): Promise<UsageResponse> => {
  const query = getQuery(event)
  const forceRefresh = query.refresh === '1'

  const [rateLimits, fiveHour, sevenDay, today, month, burnRate, hourly] = await Promise.all([
    fetchRateLimits(),
    queryWindowUsage(5),
    queryWindowUsage(168),
    queryTodayUsage(),
    queryMonthUsage(),
    queryBurnRate(),
    queryTodayHourly(),
  ])

  let context = forceRefresh ? null : getCachedContext()

  if (forceRefresh) {
    clearContextCache()
    context = await probeContext()
  } else if (!context) {
    probeContext().catch(() => {})
  }

  return {
    rateLimits,
    windows: { fiveHour, sevenDay, today, month },
    burnRate,
    hourly,
    context: context ?? emptyContext,
  }
})
