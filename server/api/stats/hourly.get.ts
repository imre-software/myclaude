import type { HourlyEntry } from '~~/app/types/stats'

export default defineEventHandler(async (): Promise<HourlyEntry[]> => {
  const stats = await parseStatsCache()

  // Return all 24 hours, filling in zeros for missing hours
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    sessionCount: stats.hourCounts[String(hour)] ?? 0,
  }))
})
