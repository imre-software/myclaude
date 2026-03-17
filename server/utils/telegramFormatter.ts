import type { NotificationEvent } from './notificationBus'

export function formatTelegramMessage(event: NotificationEvent): string {
  const lines: string[] = []

  if (event.title) {
    lines.push(`*${escapeMd(event.title)}*`)
  }

  if (event.body) {
    lines.push(escapeMd(event.body))
  }

  lines.push('_My Claude_')

  return lines.join('\n')
}

function escapeMd(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}
