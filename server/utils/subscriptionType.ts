import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

type SubscriptionType = 'max' | 'api'

let cached: SubscriptionType | null = null

export async function getSubscriptionType(): Promise<SubscriptionType> {
  if (cached) return cached
  try {
    const { stdout } = await execFileAsync('claude', ['auth', 'status', '--json'], { timeout: 10_000 })
    cached = JSON.parse(stdout).subscriptionType === 'max' ? 'max' : 'api'
  } catch {
    cached = 'max' // Safe default
  }
  return cached
}
