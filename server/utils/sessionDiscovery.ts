import { execFile } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ActiveClaudeSession } from '~~/app/types/remote'

let cache: { sessions: ActiveClaudeSession[], timestamp: number } | null = null
const CACHE_TTL = 5000

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      resolve(err ? '' : stdout)
    })
  })
}

function getCwd(pid: number): Promise<string> {
  return new Promise((resolve) => {
    execFile('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-F', 'n'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) return resolve('')
      // lsof -F n outputs lines like "p<pid>" and "n<path>"
      const match = stdout.match(/^n(.+)$/m)
      resolve(match?.[1] ?? '')
    })
  })
}

export async function discoverClaudeSessions(): Promise<ActiveClaudeSession[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.sessions
  }

  const psOutput = await exec('ps', ['-eo', 'pid,args'])
  if (!psOutput) {
    cache = { sessions: [], timestamp: Date.now() }
    return []
  }

  const lines = psOutput.split('\n')
  const claudePids: number[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Match lines where the command contains "claude" but NOT with -p or --print flags
    // These flags indicate non-interactive (scripted) usage
    const match = trimmed.match(/^(\d+)\s+(.+)$/)
    if (!match?.[1] || !match[2]) continue

    const pid = parseInt(match[1], 10)
    const cmdArgs = match[2]

    // Must contain "claude" in the command
    if (!cmdArgs.includes('claude')) continue

    // Skip our own spawned processes (claude -p)
    if (/\s-p\b/.test(cmdArgs) || /\s--print\b/.test(cmdArgs)) continue

    // Skip this process itself and node/server processes
    if (cmdArgs.includes('node') || cmdArgs.includes('nitro') || cmdArgs.includes('nuxt')) continue

    // Must look like an actual claude CLI invocation
    if (cmdArgs.includes('/bin/claude') || /\bclaude\b/.test(cmdArgs)) {
      claudePids.push(pid)
    }
  }

  // Get cwd for each process
  const sessions: ActiveClaudeSession[] = []
  const cwdsSeen = new Set<string>()

  await Promise.all(
    claudePids.map(async (pid) => {
      const cwd = await getCwd(pid)
      if (cwd && !cwdsSeen.has(cwd)) {
        cwdsSeen.add(cwd)
        sessions.push({
          pid,
          cwd,
          project: basename(cwd),
        })
      }
    }),
  )

  // Attach last assistant message from most recent transcript
  for (const session of sessions) {
    session.lastMessage = getLastTranscriptMessage(session.cwd)
  }

  // Sort by project name for consistent ordering
  sessions.sort((a, b) => a.project.localeCompare(b.project))

  cache = { sessions, timestamp: Date.now() }
  return sessions
}

export function clearSessionCache(): void {
  cache = null
}

const SUMMARY_MAX_LENGTH = 150

function getLastTranscriptMessage(cwd: string): string | undefined {
  const home = process.env.HOME
  if (!home) return undefined

  const slug = cwd.replace(/\//g, '-')
  const projectDir = join(home, '.claude', 'projects', slug)

  try {
    const files = readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const fullPath = join(projectDir, f)
        return { path: fullPath, mtime: statSync(fullPath).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)

    if (files.length === 0) return undefined

    // Use the existing transcript reader on the most recent file
    const text = extractLastAssistantText(files[0]!.path)
    if (text.startsWith('(')) return undefined // error messages like "(No assistant message...)"

    // Truncate for WhatsApp/Telegram display
    if (text.length > SUMMARY_MAX_LENGTH) {
      return text.slice(0, SUMMARY_MAX_LENGTH - 3) + '...'
    }
    return text
  } catch {
    return undefined
  }
}
