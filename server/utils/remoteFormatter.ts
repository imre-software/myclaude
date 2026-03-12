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

function escapeMd(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}
