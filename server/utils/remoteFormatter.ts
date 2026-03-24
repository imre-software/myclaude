interface RemoteMessageOptions {
  project: string
  summary: string
  hookEvent: string
  timeoutMinutes: number
  routed?: boolean
}

// WhatsApp uses simple markdown: *bold*, _italic_
export function formatRemoteWhatsApp(options: RemoteMessageOptions): string {
  const { project, summary, hookEvent, timeoutMinutes, routed } = options
  const lines: string[] = []

  if (hookEvent === 'Stop') {
    lines.push(`*Claude finished in ${project}*`)
    lines.push('')
    lines.push(summary)
    lines.push('')
    lines.push(routed
      ? `_Send your next instruction, or "done" to let Claude stop. Auto-stops in ${timeoutMinutes} min._`
      : `_Reply with your next instruction, or "done" to let Claude stop. Auto-stops in ${timeoutMinutes} min._`)
  } else if (hookEvent === 'PermissionRequest') {
    lines.push(`*Claude needs permission in ${project}*`)
    lines.push('')
    lines.push(summary)
    lines.push('')
    lines.push(routed
      ? `_"allow" to approve or "deny" to reject. Auto-denies in ${timeoutMinutes} min._`
      : `_Reply "allow" to approve or "deny" to reject. Auto-denies in ${timeoutMinutes} min._`)
  } else if (hookEvent === 'PreToolUse') {
    lines.push(`*Claude has a plan ready${routed ? '' : ` in ${project}`}*`)
    lines.push('')
    lines.push(summary)
    lines.push('')
    lines.push(routed
      ? `_"approve" to start or send feedback. Auto-rejects in ${timeoutMinutes} min._`
      : `_Reply "approve" to start or send feedback. Auto-rejects in ${timeoutMinutes} min._`)
  } else if (hookEvent === 'Notification') {
    lines.push(`*Claude notification from ${project}*`)
    lines.push('')
    lines.push(summary)
  }

  lines.push('')
  lines.push('_My Claude - Remote Mode_')
  return lines.join('\n')
}

// Telegram uses MarkdownV2: requires escaping special chars
export function formatRemoteTelegram(options: RemoteMessageOptions): string {
  const { project, summary, hookEvent, timeoutMinutes, routed } = options
  const lines: string[] = []

  if (hookEvent === 'Stop') {
    lines.push(`*Claude finished in ${escapeMd(project)}*`)
    lines.push('')
    lines.push(escapeMd(summary))
    lines.push('')
    lines.push(routed
      ? `_Send your next instruction, or "done" to let Claude stop\\. Auto\\-stops in ${timeoutMinutes} min\\._`
      : `_Reply with your next instruction, or "done" to let Claude stop\\. Auto\\-stops in ${timeoutMinutes} min\\._`)
  } else if (hookEvent === 'PermissionRequest') {
    lines.push(`*Claude needs permission in ${escapeMd(project)}*`)
    lines.push('')
    lines.push(escapeMd(summary))
    lines.push('')
    lines.push(routed
      ? `_"allow" to approve or "deny" to reject\\. Auto\\-denies in ${timeoutMinutes} min\\._`
      : `_Reply "allow" to approve or "deny" to reject\\. Auto\\-denies in ${timeoutMinutes} min\\._`)
  } else if (hookEvent === 'PreToolUse') {
    lines.push(`*Claude has a plan ready${routed ? '' : ` in ${escapeMd(project)}`}*`)
    lines.push('')
    lines.push(escapeMd(summary))
    lines.push('')
    lines.push(routed
      ? `_"approve" to start or send feedback\\. Auto\\-rejects in ${timeoutMinutes} min\\._`
      : `_Reply "approve" to start or send feedback\\. Auto\\-rejects in ${timeoutMinutes} min\\._`)
  } else if (hookEvent === 'Notification') {
    lines.push(`*Claude notification from ${escapeMd(project)}*`)
    lines.push('')
    lines.push(escapeMd(summary))
  }

  lines.push('')
  lines.push('_My Claude \\- Remote Mode_')
  return lines.join('\n')
}

// --- Chat flow formatters ---

import type { ChatAction, ActiveClaudeSession } from '~~/app/types/remote'

function formatSessionList(sessions: ActiveClaudeSession[]): string {
  return sessions
    .map((s, i) => `${i + 1}. ${s.project}`)
    .join('\n')
}

export function formatChatActionWhatsApp(action: ChatAction): string {
  switch (action.type) {
    case 'session-list':
      return `*Active Claude Sessions*\n\n${formatSessionList(action.sessions)}\n\n_Reply with a number to select a session._`

    case 'session-selected': {
      const lines = [`*Connecting to ${action.session.project}...*`]
      if (action.session.lastMessage) {
        lines.push('')
        lines.push(`_Last activity:_\n${action.session.lastMessage}`)
      }
      lines.push('')
      lines.push('Claude will message you shortly.')
      lines.push(action.routed
        ? 'Send a message to continue the conversation.'
        : 'Reply to Claude\'s messages to continue the conversation.')
      lines.push(action.routed
        ? 'Type "exit" to disconnect.'
        : 'Type "back" for session list or "exit" to disconnect.')
      return lines.join('\n')
    }

    case 'no-sessions':
      return 'No active Claude sessions found. Start Claude in a terminal first.'

    case 'chatting-hint':
      return action.routed
        ? '_Send a message to continue. Type "exit" to disconnect._'
        : '_Reply to Claude\'s messages to continue. Type "back" for sessions or "exit" to disconnect._'

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

    case 'session-selected': {
      const lines = [`Connecting to ${action.session.project}...`]
      if (action.session.lastMessage) {
        lines.push('')
        lines.push(`Last activity:\n${action.session.lastMessage}`)
      }
      lines.push('')
      lines.push('Claude will message you shortly.')
      lines.push(action.routed
        ? 'Send a message to continue the conversation.'
        : 'Reply to Claude\'s messages to continue the conversation.')
      lines.push(action.routed
        ? 'Type "exit" to disconnect.'
        : 'Type "back" for session list or "exit" to disconnect.')
      return lines.join('\n')
    }

    case 'no-sessions':
      return 'No active Claude sessions found. Start Claude in a terminal first.'

    case 'chatting-hint':
      return action.routed
        ? 'Send a message to continue. Type "exit" to disconnect.'
        : 'Reply to Claude\'s messages to continue. Type "back" for sessions or "exit" to disconnect.'

    case 'reset':
      return 'Chat disconnected.'

    case 'invalid-selection':
      return `Please reply with a number between 1 and ${action.max}.`
  }
}

function escapeMd(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}
