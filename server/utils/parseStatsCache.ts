import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { StatsCache } from '~~/app/types/stats'

let cachedData: StatsCache | null = null
let cachedMtime: number = 0

const STATS_CACHE_PATH = join(homedir(), '.claude', 'stats-cache.json')

// Claude Code writes stats-cache.json only from some clients (the IDE extension never does).
// Session data still comes from the synced DB, so a missing cache reads as empty.
const EMPTY_STATS: StatsCache = {
  version: 0,
  lastComputedDate: '',
  dailyActivity: [],
  dailyModelTokens: [],
  modelUsage: {},
  totalSessions: 0,
  totalMessages: 0,
  longestSession: {} as StatsCache['longestSession'],
  firstSessionDate: '',
  hourCounts: {},
  totalSpeculationTimeSavedMs: 0,
}

export async function parseStatsCache(): Promise<StatsCache> {
  let fileStat
  try {
    fileStat = await stat(STATS_CACHE_PATH)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_STATS
    throw err
  }
  const mtime = fileStat.mtimeMs

  if (cachedData && mtime === cachedMtime) {
    return cachedData
  }

  const raw = await readFile(STATS_CACHE_PATH, 'utf-8')
  cachedData = JSON.parse(raw) as StatsCache
  cachedMtime = mtime

  return cachedData
}
