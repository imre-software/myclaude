interface CostItem {
  amount: string
  model: string | null
}

interface CostBucket {
  starting_at: string
  ending_at: string
  results: CostItem[]
}

interface CostReport {
  data: CostBucket[]
  has_more: boolean
  next_page: string | null
}

export interface ApiSyncProgress {
  status: 'idle' | 'syncing_recent' | 'recent_done' | 'syncing_history' | 'done' | 'skipped'
  windowsTotal: number
  windowsProcessed: number
}

export const apiSyncProgress: ApiSyncProgress = {
  status: 'idle',
  windowsTotal: 0,
  windowsProcessed: 0,
}

const HISTORY_START = '2024-01-01'
const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

let syncPromise: Promise<void> | null = null

export async function syncApiCosts(): Promise<void> {
  const adminKey = useRuntimeConfig().anthropicAdminKey
  if (!adminKey) {
    apiSyncProgress.status = 'skipped'
    return
  }

  if (syncPromise) return syncPromise

  syncPromise = doSyncApiCosts(adminKey)
  try {
    await syncPromise
  } finally {
    syncPromise = null
  }
}

function getSyncState(key: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT value FROM api_sync_state WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setSyncState(key: string, value: string): void {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO api_sync_state (key, value) VALUES (?, ?)').run(key, value)
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRateLimit(url: string, headers: Record<string, string>): Promise<Response> {
  const maxRetries = 10
  let fallbackDelay = 60_000 // Start at 60 seconds

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { headers })

    if (response.status !== 429) return response

    if (attempt === maxRetries) return response

    // Use retry-after if available, otherwise fallback
    const retryAfter = response.headers.get('retry-after')
    const waitMs = retryAfter
      ? Math.max(parseInt(retryAfter, 10) * 1000, 60_000)
      : fallbackDelay

    if (import.meta.dev) {
      console.warn(`Admin API 429 - waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`)
    }

    await sleep(waitMs)
    fallbackDelay = Math.min(fallbackDelay * 2, 300_000) // Cap at 5 min
  }

  throw new Error('fetchWithRateLimit exceeded max retries')
}

function countWindows(startDate: string, endDate: string): number {
  let count = 0
  let cursor = startDate
  while (cursor < endDate) {
    count++
    cursor = addDays(cursor, 31) < endDate ? addDays(cursor, 31) : endDate
  }
  return count
}

async function fetchWindow(adminKey: string, windowStart: string, windowEnd: string): Promise<void> {
  const db = getDb()
  const upsert = db.prepare('INSERT OR REPLACE INTO api_daily_costs (date, model, cost) VALUES (?, ?, ?)')
  let page: string | null = null
  let hasMore = true

  while (hasMore) {
    const url = new URL('https://api.anthropic.com/v1/organizations/cost_report')
    url.searchParams.set('starting_at', windowStart + 'T00:00:00Z')
    url.searchParams.set('ending_at', windowEnd + 'T00:00:00Z')
    url.searchParams.set('bucket_width', '1d')
    url.searchParams.append('group_by[]', 'description')
    if (page) {
      url.searchParams.set('page', page)
    }

    const response = await fetchWithRateLimit(url.toString(), {
      'x-api-key': adminKey,
      'anthropic-version': '2023-06-01',
    })

    if (!response.ok) {
      if (import.meta.dev) {
        console.error(`Admin API error: ${response.status} ${response.statusText}`)
      }
      throw new Error(`Admin API ${response.status}`)
    }

    const report = await response.json() as CostReport

    const batchInsert = db.transaction((buckets: CostBucket[]) => {
      for (const bucket of buckets) {
        const date = bucket.starting_at.slice(0, 10)
        const modelCosts = new Map<string, number>()
        for (const item of bucket.results) {
          const model = item.model || 'unknown'
          const costCents = parseFloat(item.amount) || 0
          const costDollars = costCents / 100
          modelCosts.set(model, (modelCosts.get(model) ?? 0) + costDollars)
        }
        for (const [model, cost] of modelCosts) {
          upsert.run(date, model, cost)
        }
      }
    })

    batchInsert(report.data)

    hasMore = report.has_more
    page = report.next_page

    // After each successful request, check remaining quota
    const remaining = response.headers.get('anthropic-ratelimit-requests-remaining')
    if (remaining !== null && parseInt(remaining, 10) === 0) {
      const resetHeader = response.headers.get('anthropic-ratelimit-requests-reset')
      if (resetHeader) {
        const resetMs = new Date(resetHeader).getTime() - Date.now()
        if (resetMs > 0) await sleep(resetMs + 500)
      } else {
        await sleep(60_000)
      }
    }
  }
}

/**
 * Checks DB state to decide what needs syncing.
 * Returns { needsRecent, needsHistory } or null if fully synced and within cooldown.
 */
function determineSyncNeeds(): { needsRecent: boolean, needsHistory: boolean } | null {
  const db = getDb()
  const today = todayUtc()

  const minDate = db.prepare('SELECT MIN(date) as d FROM api_daily_costs').get() as { d: string | null }
  const maxDate = db.prepare('SELECT MAX(date) as d FROM api_daily_costs').get() as { d: string | null }

  const needsRecent = !maxDate.d || maxDate.d < today
  const needsHistory = !minDate.d || minDate.d > HISTORY_START

  // If data is fully complete, apply cooldown
  if (!needsRecent && !needsHistory) {
    const lastSyncTime = getSyncState('last_sync_time')
    if (lastSyncTime && (Date.now() - parseInt(lastSyncTime, 10)) < COOLDOWN_MS) {
      return null
    }
    // Outside cooldown - re-sync recent to get fresh current-day data
    return { needsRecent: true, needsHistory: false }
  }

  // Data is incomplete - always sync regardless of cooldown
  return { needsRecent, needsHistory }
}

async function doSyncApiCosts(adminKey: string): Promise<void> {
  const today = todayUtc()
  const needs = determineSyncNeeds()

  if (!needs) {
    apiSyncProgress.status = 'skipped'
    return
  }

  setSyncState('last_sync_time', Date.now().toString())

  const endDate = addDays(today, 1) // API ending_at is exclusive
  const recentStart = addDays(today, -30)

  // Phase 1: Fetch recent 30 days
  if (needs.needsRecent) {
    apiSyncProgress.status = 'syncing_recent'
    apiSyncProgress.windowsTotal = 0
    apiSyncProgress.windowsProcessed = 0

    try {
      await fetchWindow(adminKey, recentStart, endDate)
    } catch {
      // Failed even with retries - mark done, will retry next time
      apiSyncProgress.status = 'done'
      return
    }
  }

  // Signal recent data is ready for UI
  apiSyncProgress.status = 'recent_done'

  // Phase 2: Fill historical gap
  if (needs.needsHistory) {
    const db = getDb()
    const minDate = db.prepare('SELECT MIN(date) as d FROM api_daily_costs').get() as { d: string | null }
    const historyEnd = minDate.d && minDate.d < recentStart ? minDate.d : recentStart

    if (!minDate.d || minDate.d > HISTORY_START) {
      const totalWindows = countWindows(HISTORY_START, historyEnd)
      apiSyncProgress.status = 'syncing_history'
      apiSyncProgress.windowsTotal = totalWindows
      apiSyncProgress.windowsProcessed = 0

      let windowStart = HISTORY_START
      while (windowStart < historyEnd) {
        const windowEnd = addDays(windowStart, 31) < historyEnd
          ? addDays(windowStart, 31)
          : historyEnd

        try {
          await fetchWindow(adminKey, windowStart, windowEnd)
        } catch {
          // Stop but keep what we have - will resume from gap next time
          break
        }

        apiSyncProgress.windowsProcessed++
        windowStart = windowEnd

        // 1 second between windows
        if (windowStart < historyEnd) {
          await sleep(1000)
        }
      }
    }
  }

  apiSyncProgress.status = 'done'
}
