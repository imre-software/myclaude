import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const VALID_SOUNDS = new Set([
  'default', 'Basso', 'Blow', 'Bottle', 'Frog', 'Funk', 'Glass',
  'Hero', 'Morse', 'Ping', 'Pop', 'Purr', 'Sosumi', 'Submarine', 'Tink',
])

export default defineEventHandler(async (event) => {
  const { title, body, sound } = await readBody(event)

  const resolvedSound = sound && VALID_SOUNDS.has(sound) ? sound : null
  const soundClause = resolvedSound
    ? ` sound name "${resolvedSound}"`
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
