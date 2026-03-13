import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { join } from 'node:path'

const activeProcesses = new Set<ChildProcess>()

export function killAllExecutors(): number {
  let killed = 0
  for (const child of activeProcesses) {
    child.kill('SIGTERM')
    killed++
  }
  activeProcesses.clear()
  return killed
}

interface SpawnResult {
  child: ChildProcess
  onExit: Promise<void>
}

export function spawnChatSession(cwd: string, initialPrompt: string): SpawnResult {
  const claudePath = process.env.HOME
    ? join(process.env.HOME, '.local', 'bin', 'claude')
    : 'claude'

  const child = spawn(
    claudePath,
    ['-p', '--continue', initialPrompt],
    {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  )

  activeProcesses.add(child)

  child.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.log('[remote-executor] stderr:', msg)
  })

  const onExit = new Promise<void>((resolve) => {
    child.on('error', (err) => {
      console.error('[remote-executor] process error:', err.message)
      activeProcesses.delete(child)
      resolve()
    })

    child.on('close', (code) => {
      if (import.meta.dev) {
        console.log('[remote-executor] process exited with code', code)
      }
      activeProcesses.delete(child)
      resolve()
    })
  })

  return { child, onExit }
}
