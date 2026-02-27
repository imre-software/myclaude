import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { StatsCache } from '~~/app/types/stats'

let cachedData: StatsCache | null = null
let cachedMtime: number = 0

const STATS_CACHE_PATH = join(homedir(), '.claude', 'stats-cache.json')

export async function parseStatsCache(): Promise<StatsCache> {
  const fileStat = await stat(STATS_CACHE_PATH)
  const mtime = fileStat.mtimeMs

  if (cachedData && mtime === cachedMtime) {
    return cachedData
  }

  const raw = await readFile(STATS_CACHE_PATH, 'utf-8')
  cachedData = JSON.parse(raw) as StatsCache
  cachedMtime = mtime

  return cachedData
}
