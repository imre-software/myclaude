import type { NotificationEvent } from './notificationBus'

export function formatWhatsAppMessage(event: NotificationEvent): string {
  const lines: string[] = []

  if (event.title) {
    lines.push(`*${event.title}*`)
  }

  if (event.body) {
    lines.push(event.body)
  }

  lines.push('_Claude Command_')

  return lines.join('\n')
}
