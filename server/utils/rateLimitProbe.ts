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

export async function fetchRateLimits(): Promise<RateLimitInfo | null> {
  if (cachedResult && (Date.now() - cachedResult.fetchedAt) < CACHE_TTL) {
    return cachedResult.data
  }

  const accessToken = await getValidToken()
  if (!accessToken) return null

  try {
    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
    })

    if (!response.ok) return null

    const body = await response.json()

    const mapWindow = (w: { utilization: number, resets_at: string | null } | null) => {
      if (!w) return null
      return { utilization: w.utilization, resetsAt: w.resets_at }
    }

    const result: RateLimitInfo = {
      fiveHour: mapWindow(body.five_hour)!,
      sevenDay: mapWindow(body.seven_day)!,
      sevenDaySonnet: mapWindow(body.seven_day_sonnet),
      sevenDayOpus: mapWindow(body.seven_day_opus),
      extraUsage: body.extra_usage
        ? {
            isEnabled: body.extra_usage.is_enabled,
            monthlyLimit: body.extra_usage.monthly_limit,
            usedCredits: body.extra_usage.used_credits,
            utilization: body.extra_usage.utilization,
          }
        : null,
    }

    cachedResult = { data: result, fetchedAt: Date.now() }
    return result
  } catch {
    return null
  }
}
