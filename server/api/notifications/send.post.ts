import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export default defineEventHandler(async (event) => {
  const { title, body, sound } = await readBody(event)

  const soundClause = sound && sound !== 'none'
    ? ` sound name "${sound === 'default' ? 'default' : sound}"`
    : ''

  const script = `display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}"${soundClause}`

  try {
    await execFileAsync('osascript', ['-e', script], { timeout: 5_000 })
    return { ok: true }
  } catch (err) {
    if (import.meta.dev) console.error('[notifications] osascript failed:', err)
    return { ok: false }
  }
})

function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
