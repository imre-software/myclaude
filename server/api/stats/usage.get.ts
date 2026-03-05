import type { UsageResponse } from '~~/app/types/usage'
import { clearContextCache, getCachedContext, probeContext } from '~~/server/utils/contextProbe'
import { clearRateLimitCache } from '~~/server/utils/rateLimitProbe'

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

  if (forceRefresh) {
    clearRateLimitCache()
  }

  const [rateLimits, fiveHour, sevenDay, today, month, burnRate, hourly] = await Promise.all([
    fetchRateLimits(),
    queryWindowUsage(5),
    queryWindowUsage(168),
    queryTodayUsage(),
    queryMonthUsage(),
    queryBurnRate(),
    queryTodayHourly(),
  ])

  let context = getCachedContext()

  if (forceRefresh) {
    clearContextCache()
    probeContext().catch(() => {})
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
