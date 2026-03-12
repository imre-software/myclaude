import type { TelegramStatus, TelegramBotInfo } from '~~/app/types/telegram'
import type { BusEvent, NotificationEvent } from './notificationBus'

const TELEGRAM_API = 'https://api.telegram.org/bot'

let busUnsubscribe: (() => void) | null = null

function registerBusListener(): void {
  if (busUnsubscribe) return

  busUnsubscribe = onNotificationEvent((event: BusEvent) => {
    if (event.type === 'usage-update') return

    const settings = getNotificationSettings()
    if (!settings.telegram.enabled || !settings.telegram.botToken || !settings.telegram.chatId) return

    // Check quiet hours
    if (settings.quietHours.enabled) {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const { start, end } = settings.quietHours
      if (start <= end) {
        if (hhmm >= start && hhmm < end) return
      } else {
        if (hhmm >= start || hhmm < end) return
      }
    }

    const text = formatTelegramMessage(event as NotificationEvent)
    sendTelegramMessage(settings.telegram.botToken, settings.telegram.chatId, text)
  })
}

function unregisterBusListener(): void {
  if (busUnsubscribe) {
    busUnsubscribe()
    busUnsubscribe = null
  }
}

export async function validateTelegramToken(token: string): Promise<TelegramBotInfo> {
  const res = await $fetch<{ ok: boolean, result: TelegramBotInfo }>(`${TELEGRAM_API}${token}/getMe`)
  if (!res.ok) {
    throw createError({ statusCode: 400, message: 'Invalid bot token' })
  }
  return res.result
}

export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    await $fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      body: {
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
      },
    })
    return true
  } catch (err) {
    if (import.meta.dev) console.error('[telegram] send failed:', err)
    return false
  }
}

export function getTelegramStatus(): TelegramStatus {
  const settings = getNotificationSettings()
  return {
    connected: !!settings.telegram.botToken && !!settings.telegram.chatId,
    botName: settings.telegram.botName,
    chatId: settings.telegram.chatId,
  }
}

export function connectTelegram(): void {
  registerBusListener()
}

export function disconnectTelegram(): void {
  unregisterBusListener()
  const settings = getNotificationSettings()
  settings.telegram.botToken = ''
  settings.telegram.chatId = ''
  settings.telegram.botName = ''
  settings.telegram.enabled = false
  saveNotificationSettings(settings)
}

export async function sendTelegramMessageForRemote(token: string, chatId: string, text: string): Promise<number | null> {
  try {
    const res = await $fetch<{ ok: boolean, result: { message_id: number } }>(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      body: {
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
      },
    })
    return res.result?.message_id ?? null
  } catch (err) {
    if (import.meta.dev) console.error('[telegram] remote send failed:', err)
    return null
  }
}

export function tryTelegramAutoConnect(): void {
  const settings = getNotificationSettings()
  if (settings.telegram.enabled && settings.telegram.botToken && settings.telegram.chatId) {
    registerBusListener()
  }
}
