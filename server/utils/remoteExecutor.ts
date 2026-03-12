import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { join } from 'node:path'

const TIMEOUT_MS = 120_000

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

export async function executeInSession(cwd: string, message: string): Promise<string> {
  const claudePath = process.env.HOME
    ? join(process.env.HOME, '.local', 'bin', 'claude')
    : 'claude'

  return new Promise((resolve) => {
    const child = spawn(
      claudePath,
      ['-p', '--output-format', 'json', message],
      {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    activeProcesses.add(child)

    let stdout = ''
    let stderr = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGTERM')
      // Force kill after 5s if SIGTERM doesn't work
      setTimeout(() => child.kill('SIGKILL'), 5000)
    }, TIMEOUT_MS)

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

    child.on('error', (err) => {
      clearTimeout(timer)
      activeProcesses.delete(child)
      resolve(`Error: ${err.message}`)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      activeProcesses.delete(child)

      if (killed) {
        resolve('Claude took too long to respond (2 minute timeout). Try a simpler question.')
        return
      }

      if (code !== 0) {
        resolve(`Error: ${stderr || `Process exited with code ${code}`}`)
        return
      }

      try {
        const json = JSON.parse(stdout)
        const result = (json.result as string) ?? ''
        resolve(result || 'Claude returned an empty response.')
      } catch {
        // If JSON parsing fails, return raw stdout
        resolve(stdout || 'Claude returned an empty response.')
      }
    })
  })
}
