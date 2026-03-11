import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { RateLimitInfo } from '~~/app/types/usage'

const execFileAsync = promisify(execFile)

let cachedResult: { data: RateLimitInfo, fetchedAt: number, rateLimited?: boolean } | null = null
let cachedToken: { accessToken: string, expiresAt: number } | null = null

// Anthropic's /api/oauth/usage has ~5 requests per token before 429.
// 5 min TTL ensures we don't burn through the quota on repeated refreshes.
const CACHE_TTL = 300_000

// ---- SQLite persistence ----

const DB_CACHE_KEY = 'rate_limit_cache'

function persistToDb(data: RateLimitInfo): void {
  try {
    const db = getDb()
    const payload = JSON.stringify({ data, savedAt: Date.now() })
    db.prepare(
      'INSERT OR REPLACE INTO notification_settings (key, value) VALUES (?, ?)',
    ).run(DB_CACHE_KEY, payload)
  } catch {
    // Non-critical - in-memory cache still works
  }
}

function loadFromDb(): RateLimitInfo | null {
  try {
    const db = getDb()
    const row = db.prepare(
      'SELECT value FROM notification_settings WHERE key = ?',
    ).get(DB_CACHE_KEY) as { value: string } | undefined
    if (!row) return null
    const parsed = JSON.parse(row.value) as { data: RateLimitInfo, savedAt: number }
    return parsed.data
  } catch {
    return null
  }
}

async function readKeychainToken(): Promise<{ accessToken: string, expiresAt: number } | null> {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-s', 'Claude Code-credentials',
      '-w',
    ], { timeout: 10_000 })

    const parsed = JSON.parse(stdout.trim())
    const oauth = parsed.claudeAiOauth
    if (!oauth?.accessToken) return null

    return {
      accessToken: oauth.accessToken,
      expiresAt: oauth.expiresAt ?? 0,
    }
  } catch {
    return null
  }
}

async function getValidToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken
  }

  let token = await readKeychainToken()

  // If expired, trigger CLI refresh and re-read
  if (token && token.expiresAt <= Date.now()) {
    try {
      await execFileAsync('claude', ['auth', 'status'], { timeout: 15_000 })
    } catch {
      // Refresh may still succeed
    }
    token = await readKeychainToken()
  }

  if (!token) return null

  cachedToken = token
  return token.accessToken
}

interface OAuthUsageResponse {
  five_hour: { utilization: number, resets_at: string } | null
  seven_day: { utilization: number, resets_at: string } | null
  seven_day_sonnet: { utilization: number, resets_at: string } | null
  seven_day_opus: { utilization: number, resets_at: string } | null
  extra_usage: {
    is_enabled: boolean
    monthly_limit: number | null
    used_credits: number | null
    utilization: number | null
  } | null
}

function mapWindow(w: { utilization: number, resets_at: string } | null): { utilization: number, resetsAt: string | null } | null {
  if (!w) return null
  return { utilization: w.utilization, resetsAt: w.resets_at }
}

export function clearRateLimitCache() {
  // Don't force a re-fetch if we were just rate limited - avoid burning quota
  if (cachedResult?.rateLimited) return
  // Mark cache as stale but keep the data as fallback for errors
  if (cachedResult) {
    cachedResult.fetchedAt = 0
  }
}

/**
 * Returns cached rate limits without hitting the API.
 * Falls back to SQLite if in-memory cache is empty.
 */
export function getCachedRateLimits(): RateLimitInfo | null {
  return cachedResult?.data ?? loadFromDb()
}

/**
 * Returns whether the last API call was rate limited (429).
 */
export function wasRateLimited(): boolean {
  return cachedResult?.rateLimited ?? false
}

function parseResponse(json: OAuthUsageResponse): RateLimitInfo | null {
  const fiveHour = mapWindow(json.five_hour)
  const sevenDay = mapWindow(json.seven_day)
  if (!fiveHour || !sevenDay) return null

  const extra = json.extra_usage
  return {
    fiveHour,
    sevenDay,
    sevenDaySonnet: mapWindow(json.seven_day_sonnet),
    sevenDayOpus: mapWindow(json.seven_day_opus),
    extraUsage: extra ? {
      isEnabled: extra.is_enabled,
      monthlyLimit: extra.monthly_limit,
      usedCredits: extra.used_credits,
      utilization: extra.utilization,
    } : null,
  }
}

/**
 * Returns the best available fallback: in-memory cache, then SQLite.
 */
function getFallback(): RateLimitInfo | null {
  return cachedResult?.data ?? loadFromDb()
}

/**
 * Fetches rate limits from the Anthropic OAuth API.
 * Falls back to in-memory cache, then SQLite, on any error.
 * On success, persists to both in-memory cache and SQLite so
 * data survives server restarts and 429 storms.
 */
export async function fetchRateLimits(): Promise<RateLimitInfo | null> {
  // Serve from in-memory cache if fresh
  if (cachedResult && (Date.now() - cachedResult.fetchedAt) < CACHE_TTL) {
    return cachedResult.data
  }

  const accessToken = await getValidToken()
  if (!accessToken) return getFallback()

  try {
    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
    })

    console.log(`[rateLimitProbe] API response status: ${response.status}`)

    if (response.status === 429) {
      console.warn('[rateLimitProbe] 429 rate limited - falling back to cached data')
      const fallback = getFallback()
      if (fallback) {
        cachedResult = { data: fallback, fetchedAt: Date.now(), rateLimited: true }
      }
      return fallback
    }

    if (!response.ok) {
      console.warn(`[rateLimitProbe] API error: ${response.status}`)
      return getFallback()
    }

    const json = await response.json() as OAuthUsageResponse
    const result = parseResponse(json)
    if (!result) return getFallback()

    cachedResult = { data: result, fetchedAt: Date.now(), rateLimited: false }
    persistToDb(result)
    return result
  } catch {
    return getFallback()
  }
}
