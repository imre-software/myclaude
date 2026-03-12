import { basename } from 'node:path'
import type { RemoteHookPayload } from '~~/app/types/remote'

const DONE_PATTERNS = /^(done|stop|finish|ok|quit|exit)$/i

export default defineEventHandler(async (event) => {
  const body = await readBody<RemoteHookPayload>(event)
  if (!body?.hook_event_name) {
    return {}
  }

  const settings = getNotificationSettings()
  const remote = settings.remoteMode
  if (!remote?.enabled) return {}

  const hookEvent = body.hook_event_name

  // Check if the specific hook type is enabled
  if (hookEvent === 'Stop' && !remote.hooks.stop) return {}
  if (hookEvent === 'PermissionRequest' && !remote.hooks.permissionRequest) return {}
  if (hookEvent === 'Notification' && !remote.hooks.notification) return {}

  const project = body.cwd ? basename(body.cwd) : 'unknown'

  // Build the summary based on hook type
  let summary: string
  if (hookEvent === 'Stop') {
    summary = body.transcript_path
      ? extractLastAssistantText(body.transcript_path)
      : '(No transcript available)'
  } else if (hookEvent === 'PermissionRequest') {
    const toolName = body.tool_name ?? 'unknown tool'
    const toolInput = body.tool_input
      ? JSON.stringify(body.tool_input, null, 2).slice(0, 300)
      : ''
    summary = `${toolName}\n${toolInput}`
  } else {
    // Notification - extract from transcript or use generic
    summary = body.transcript_path
      ? extractLastAssistantText(body.transcript_path)
      : 'Claude is waiting for input'
  }

  // Send to enabled channels and collect message IDs
  const messageIds: { whatsapp?: string, telegram?: number } = {}
  const channels: string[] = []

  if (remote.channels.whatsapp && settings.whatsapp.enabled && settings.whatsapp.phoneNumber) {
    const text = formatRemoteWhatsApp({ project, summary, hookEvent, timeoutMinutes: remote.timeoutMinutes })
    const waId = await sendWhatsAppMessageForRemote(settings.whatsapp.phoneNumber, text)
    if (waId) {
      messageIds.whatsapp = waId
      channels.push('whatsapp')
    }
  }

  if (remote.channels.telegram && settings.telegram.enabled && settings.telegram.botToken && settings.telegram.chatId) {
    const text = formatRemoteTelegram({ project, summary, hookEvent, timeoutMinutes: remote.timeoutMinutes })
    const tgId = await sendTelegramMessageForRemote(settings.telegram.botToken, settings.telegram.chatId, text)
    if (tgId) {
      messageIds.telegram = tgId
      channels.push('telegram')
    }
  }

  // If no messages were sent, return empty (graceful degradation)
  if (channels.length === 0) return {}

  // Log the outgoing message
  const db = getDb()
  const logResult = db.prepare(`
    INSERT INTO remote_mode_log (session_id, hook_event, project, summary, channel, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(body.session_id ?? '', hookEvent, project, summary.slice(0, 500), channels.join(','), 'pending')
  const logId = Number(logResult.lastInsertRowid)

  // Notification hooks are fire-and-forget
  if (hookEvent === 'Notification') {
    db.prepare('UPDATE remote_mode_log SET status = ? WHERE id = ?').run('replied', logId)
    return {}
  }

  // For Stop and PermissionRequest, wait for reply
  // Disable Node.js socket timeout for long-polling
  event.node.req.socket.setTimeout(0)

  // Start telegram polling if needed
  if (messageIds.telegram) {
    startTelegramPolling()
  }

  const timeoutMs = remote.timeoutMinutes * 60 * 1000
  const reply = await waitForReply(body.session_id ?? '', hookEvent, messageIds, timeoutMs)

  // Update log
  if (reply) {
    db.prepare('UPDATE remote_mode_log SET user_reply = ?, replied_at = datetime(\'now\', \'localtime\'), status = ? WHERE id = ?')
      .run(reply, 'replied', logId)
  } else {
    db.prepare('UPDATE remote_mode_log SET status = ? WHERE id = ?').run('timeout', logId)
  }

  // Build response based on hook type
  if (hookEvent === 'Stop') {
    if (!reply || DONE_PATTERNS.test(reply.trim())) {
      return {}
    }
    return {
      decision: 'block',
      reason: `User instruction via remote: ${reply}`,
    }
  }

  if (hookEvent === 'PermissionRequest') {
    const allowed = /^(allow|yes|approve|ok)$/i.test((reply ?? '').trim())
    return {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: allowed ? 'allow' : 'deny',
        },
      },
    }
  }

  return {}
})
