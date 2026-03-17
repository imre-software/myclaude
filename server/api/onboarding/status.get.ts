import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const execFileAsync = promisify(execFile)

interface OnboardingStatus {
  completed: boolean
  claudeInstalled: boolean
  claudeAuthenticated: boolean
  hasSessions: boolean
  subscriptionType: 'max' | 'api' | null
}

async function checkClaudeInstalled(): Promise<boolean> {
  const localBin = join(homedir(), '.local', 'bin', 'claude')
  if (existsSync(localBin)) return true

  try {
    await execFileAsync('which', ['claude'], { timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

async function checkClaudeAuth(): Promise<{ authenticated: boolean, subscriptionType: 'max' | 'api' | null }> {
  try {
    const { stdout } = await execFileAsync('claude', ['auth', 'status', '--json'], { timeout: 10_000 })
    const data = JSON.parse(stdout)
    return {
      authenticated: true,
      subscriptionType: data.subscriptionType === 'max' ? 'max' : 'api',
    }
  } catch {
    return { authenticated: false, subscriptionType: null }
  }
}

function checkHasSessions(): boolean {
  try {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE message_count >= 2').get() as { count: number }
    return row.count > 0
  } catch {
    return false
  }
}

function isOnboardingCompleted(): boolean {
  try {
    const db = getDb()
    const row = db.prepare(
      "SELECT value FROM notification_settings WHERE key = 'onboarding_completed'",
    ).get() as { value: string } | undefined
    return row?.value === 'true'
  } catch {
    return false
  }
}

export default defineEventHandler(async (): Promise<OnboardingStatus> => {
  const completed = isOnboardingCompleted()

  const [claudeInstalled, authResult, hasSessions] = await Promise.all([
    checkClaudeInstalled(),
    checkClaudeAuth(),
    Promise.resolve(checkHasSessions()),
  ])

  return {
    completed,
    claudeInstalled,
    claudeAuthenticated: authResult.authenticated,
    hasSessions,
    subscriptionType: authResult.subscriptionType,
  }
})
