const TELEGRAM_API = 'https://api.telegram.org/bot'

let pollingInterval: ReturnType<typeof setInterval> | null = null
let lastUpdateId = 0

export function startTelegramPolling(): void {
  if (pollingInterval) return

  console.log('[telegram-poller] starting polling for remote messages')

  pollingInterval = setInterval(async () => {
    const settings = getNotificationSettings()
    if (!settings.remoteMode?.enabled || !settings.remoteMode.channels.telegram) {
      stopTelegramPolling()
      return
    }

    if (!settings.telegram.botToken || !settings.telegram.chatId) return

    try {
      const res = await $fetch<{
        ok: boolean
        result: Array<{
          update_id: number
          message?: {
            message_id: number
            from?: { id: number }
            chat?: { id: number }
            text?: string
            reply_to_message?: {
              message_id: number
            }
          }
        }>
      }>(`${TELEGRAM_API}${settings.telegram.botToken}/getUpdates`, {
        params: {
          offset: lastUpdateId + 1,
          timeout: 1,
          allowed_updates: JSON.stringify(['message']),
        },
      })

      if (!res.ok || !res.result?.length) return

      for (const update of res.result) {
        lastUpdateId = update.update_id

        const msg = update.message
        if (!msg?.text) continue

        // Only accept messages from the configured chat
        if (String(msg.chat?.id) !== settings.telegram.chatId) continue

        // "kill" from any context cancels all pending hooks + executors
        if (msg.text.trim().toLowerCase() === 'kill') {
          cancelPending()
          killAllExecutors()
          sendTelegramMessagePlain(settings.telegram.botToken, settings.telegram.chatId, 'All pending tasks and processes killed.')
          continue
        }

        const replyToId = msg.reply_to_message?.message_id

        if (replyToId) {
          // Try hook-reply flow first; if no pending hook matches, fall through to chat
          const delivered = deliverReply(msg.text, replyToId)
          if (!delivered) {
            handleTelegramChatMessage(settings.telegram.botToken, settings.telegram.chatId, msg.text)
          }
        } else {
          // New message (not a reply) - route to chat flow
          handleTelegramChatMessage(settings.telegram.botToken, settings.telegram.chatId, msg.text)
        }
      }
    } catch (err) {
      if (import.meta.dev) console.error('[telegram-poller] poll error:', err)
    }
  }, 2000)
}

export function stopTelegramPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
    console.log('[telegram-poller] stopped polling')
  }
}

export function isTelegramPolling(): boolean {
  return pollingInterval !== null
}

async function handleTelegramChatMessage(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    const action = await handleChatMessage('telegram', text)
    if (!action) return // message ignored (no "claude" keyword while idle)
    const response = formatChatActionTelegram(action)
    await sendTelegramMessagePlain(botToken, chatId, response)
  } catch (err) {
    if (import.meta.dev) console.error('[telegram-poller] chat message error:', err)
    await sendTelegramMessagePlain(botToken, chatId, 'An error occurred processing your message.')
  }
}
