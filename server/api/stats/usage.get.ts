import type { UsageResponse, PaceInfo } from '~~/app/types/usage'
import { clearContextCache, getCachedContext, probeContext } from '~~/server/utils/contextProbe'
import { clearRateLimitCache, wasRateLimited } from '~~/server/utils/rateLimitProbe'

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

  // Compute pace projections per window
  let pace: PaceInfo | null = null
  if (rateLimits) {
    const computeWindowPace = (windowType: string, window: { utilization: number, resetsAt: string | null } | null) => {
      if (!window) return null
      return calculatePace(windowType, window.utilization, window.resetsAt)
    }

    pace = {
      fiveHour: computeWindowPace('fiveHour', rateLimits.fiveHour),
      sevenDay: computeWindowPace('sevenDay', rateLimits.sevenDay),
      sevenDaySonnet: computeWindowPace('sevenDaySonnet', rateLimits.sevenDaySonnet),
      sevenDayOpus: computeWindowPace('sevenDayOpus', rateLimits.sevenDayOpus),
    }
  }

  return {
    rateLimits,
    rateLimited: wasRateLimited(),
    windows: { fiveHour, sevenDay, today, month },
    burnRate,
    hourly,
    context: context ?? emptyContext,
    pace,
  }
})
