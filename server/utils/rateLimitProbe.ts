import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { RateLimitInfo } from '~~/app/types/usage'

const execFileAsync = promisify(execFile)

let cachedResult: { data: RateLimitInfo, fetchedAt: number } | null = null
let cachedToken: { accessToken: string, expiresAt: number } | null = null

const CACHE_TTL = 60_000

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

function parseUtilization(headers: Headers, prefix: string): { utilization: number, resetsAt: string | null } | null {
  const raw = headers.get(`anthropic-ratelimit-unified-${prefix}-utilization`)
  if (!raw) return null

  const utilization = parseFloat(raw) * 100
  const resetEpoch = headers.get(`anthropic-ratelimit-unified-${prefix}-reset`)
  const resetsAt = resetEpoch ? new Date(parseInt(resetEpoch, 10) * 1000).toISOString() : null

  return { utilization, resetsAt }
}

export function clearRateLimitCache() {
  cachedResult = null
}

export async function fetchRateLimits(): Promise<RateLimitInfo | null> {
  if (cachedResult && (Date.now() - cachedResult.fetchedAt) < CACHE_TTL) {
    return cachedResult.data
  }

  const accessToken = await getValidToken()
  if (!accessToken) return null

  try {
    // Minimal 1-token inference call to read rate limit headers
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })

    if (!response.ok) return cachedResult?.data ?? null

    const fiveHour = parseUtilization(response.headers, '5h')
    const sevenDay = parseUtilization(response.headers, '7d')

    if (!fiveHour || !sevenDay) return cachedResult?.data ?? null

    const result: RateLimitInfo = {
      fiveHour,
      sevenDay,
      sevenDaySonnet: parseUtilization(response.headers, '7d_sonnet'),
      sevenDayOpus: parseUtilization(response.headers, '7d_opus'),
      extraUsage: null,
    }

    cachedResult = { data: result, fetchedAt: Date.now() }
    return result
  } catch {
    return cachedResult?.data ?? null
  }
}
