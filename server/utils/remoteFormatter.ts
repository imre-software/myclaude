interface RemoteMessageOptions {
  project: string
  summary: string
  hookEvent: string
  timeoutMinutes: number
}

// WhatsApp uses simple markdown: *bold*, _italic_
export function formatRemoteWhatsApp(options: RemoteMessageOptions): string {
  const { project, summary, hookEvent, timeoutMinutes } = options
  const lines: string[] = []

  if (hookEvent === 'Stop') {
    lines.push(`*Claude finished in ${project}*`)
    lines.push('')
    lines.push(summary)
    lines.push('')
    lines.push(`_Reply with your next instruction, or "done" to let Claude stop. Auto-stops in ${timeoutMinutes} min._`)
  } else if (hookEvent === 'PermissionRequest') {
    lines.push(`*Claude needs permission in ${project}*`)
    lines.push('')
    lines.push(summary)
    lines.push('')
    lines.push(`_Reply "allow" to approve or "deny" to reject. Auto-denies in ${timeoutMinutes} min._`)
  } else if (hookEvent === 'Notification') {
    lines.push(`*Claude notification from ${project}*`)
    lines.push('')
    lines.push(summary)
  }

  lines.push('')
  lines.push('_Claude Command - Remote Mode_')
  return lines.join('\n')
}

// Telegram uses MarkdownV2: requires escaping special chars
export function formatRemoteTelegram(options: RemoteMessageOptions): string {
  const { project, summary, hookEvent, timeoutMinutes } = options
  const lines: string[] = []

  if (hookEvent === 'Stop') {
    lines.push(`*Claude finished in ${escapeMd(project)}*`)
    lines.push('')
    lines.push(escapeMd(summary))
    lines.push('')
    lines.push(`_Reply with your next instruction, or "done" to let Claude stop\\. Auto\\-stops in ${timeoutMinutes} min\\._`)
  } else if (hookEvent === 'PermissionRequest') {
    lines.push(`*Claude needs permission in ${escapeMd(project)}*`)
    lines.push('')
    lines.push(escapeMd(summary))
    lines.push('')
    lines.push(`_Reply "allow" to approve or "deny" to reject\\. Auto\\-denies in ${timeoutMinutes} min\\._`)
  } else if (hookEvent === 'Notification') {
    lines.push(`*Claude notification from ${escapeMd(project)}*`)
    lines.push('')
    lines.push(escapeMd(summary))
  }

  lines.push('')
  lines.push('_Claude Command \\- Remote Mode_')
  return lines.join('\n')
}

// --- Chat flow formatters ---

import type { ChatAction, ActiveClaudeSession } from '~~/app/types/remote'

const WHATSAPP_CHAR_LIMIT = 4096
const TELEGRAM_CHAR_LIMIT = 4096

function truncateResponse(text: string, limit: number, suffix: string): string {
  if (text.length <= limit) return text
  return text.slice(0, limit - suffix.length) + suffix
}

function formatSessionList(sessions: ActiveClaudeSession[]): string {
  return sessions
    .map((s, i) => `${i + 1}. ${s.project} (${s.cwd})`)
    .join('\n')
}

export function formatChatActionWhatsApp(action: ChatAction): string {
  switch (action.type) {
    case 'session-list':
      return `*Active Claude Sessions*\n\n${formatSessionList(action.sessions)}\n\n_Reply with a number to select a session._`

    case 'session-selected':
      return `*Connected to ${action.session.project}*\n\nSend messages to chat with Claude in this project.\nType "back" for session list or "exit" to disconnect.`

    case 'no-sessions':
      return 'No active Claude sessions found. Start Claude in a terminal first.'

    case 'chat-response': {
      const header = `*${action.project}*\n\n`
      const footer = '\n\n_Type "back" for sessions or "exit" to disconnect._'
      const maxBody = WHATSAPP_CHAR_LIMIT - header.length - footer.length
      const body = truncateResponse(action.response, maxBody, '\n... (truncated)')
      return header + body + footer
    }

    case 'chat-error':
      return `*Error*\n\n${action.error}`

    case 'still-processing':
      return '_Still processing your previous message. Please wait._'

    case 'reset':
      return 'Chat disconnected.'

    case 'invalid-selection':
      return `Please reply with a number between 1 and ${action.max}.`
  }
}

export function formatChatActionTelegram(action: ChatAction): string {
  switch (action.type) {
    case 'session-list':
      return `Active Claude Sessions\n\n${formatSessionList(action.sessions)}\n\nReply with a number to select a session.`

    case 'session-selected':
      return `Connected to ${action.session.project}\n\nSend messages to chat with Claude in this project.\nType "back" for session list or "exit" to disconnect.`

    case 'no-sessions':
      return 'No active Claude sessions found. Start Claude in a terminal first.'

    case 'chat-response': {
      const header = `${action.project}\n\n`
      const footer = '\n\nType "back" for sessions or "exit" to disconnect.'
      const maxBody = TELEGRAM_CHAR_LIMIT - header.length - footer.length
      const body = truncateResponse(action.response, maxBody, '\n... (truncated)')
      return header + body + footer
    }

    case 'chat-error':
      return `Error: ${action.error}`

    case 'still-processing':
      return 'Still processing your previous message. Please wait.'

    case 'reset':
      return 'Chat disconnected.'

    case 'invalid-selection':
      return `Please reply with a number between 1 and ${action.max}.`
  }
}

function escapeMd(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}
