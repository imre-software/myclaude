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
            chat?: { id: number, title?: string, type?: string }
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

      // Build set of allowed chat IDs: default + all routed
      const allowedChatIds = new Set([
        settings.telegram.chatId,
        ...getAllRoutedTelegramChatIds(),
      ])

      for (const update of res.result) {
        lastUpdateId = update.update_id

        const msg = update.message
        if (!msg?.text) continue

        const chatIdStr = String(msg.chat?.id)

        // Only accept messages from allowed chats
        if (!allowedChatIds.has(chatIdStr)) continue

        const isDefaultChat = chatIdStr === settings.telegram.chatId
        const isReply = !!msg.reply_to_message
        const routingRule = !isDefaultChat ? getRoutingForTelegramChat(chatIdStr) : null
        const isRoutedGroup = !!routingRule

        // Mention-only filter for non-default, non-routed chats (groups)
        if (settings.telegram.mentionOnly && !isDefaultChat && !isRoutedGroup && !isReply) {
          const botUsername = settings.telegram.botName
          if (botUsername && !msg.text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) {
            continue
          }
        }

        // "kill" from any context cancels all pending hooks + executors
        if (msg.text.trim().toLowerCase() === 'kill') {
          cancelPending()
          killAllExecutors()
          sendTelegramMessagePlain(settings.telegram.botToken, chatIdStr, 'All pending tasks and processes killed.')
          continue
        }

        const replyToId = msg.reply_to_message?.message_id

        if (replyToId) {
          // Quote-reply always tries hook-reply first (backwards compatible)
          const delivered = deliverReply(msg.text, replyToId)
          if (!delivered) {
            handleTelegramChatMessage(settings.telegram.botToken, chatIdStr, msg.text, routingRule?.projectName)
          }
        } else if (isRoutedGroup) {
          // Routed group without reply: try delivering to pending hook for this group
          const delivered = deliverReplyByGroupJid(msg.text, chatIdStr, 'telegram')
          if (!delivered) {
            handleTelegramChatMessage(settings.telegram.botToken, chatIdStr, msg.text, routingRule?.projectName)
          }
        } else {
          // Default chat or non-routed: existing behavior
          handleTelegramChatMessage(settings.telegram.botToken, chatIdStr, msg.text)
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

async function handleTelegramChatMessage(botToken: string, chatId: string, text: string, routedProject?: string): Promise<void> {
  try {
    const action = await handleChatMessage('telegram', chatId, text, routedProject)
    if (!action) return // message ignored (no "claude" keyword while idle)
    const response = formatChatActionTelegram(action)
    await sendTelegramMessagePlain(botToken, chatId, response)
  } catch (err) {
    if (import.meta.dev) console.error('[telegram-poller] chat message error:', err)
    await sendTelegramMessagePlain(botToken, chatId, 'An error occurred processing your message.')
  }
}
