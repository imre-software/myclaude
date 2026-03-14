const TELEGRAM_API = 'https://api.telegram.org/bot'

export default defineEventHandler(async () => {
  const settings = getNotificationSettings()

  if (!settings.telegram.enabled || !settings.telegram.botToken) {
    throw createError({ statusCode: 400, message: 'Telegram bot not connected' })
  }

  try {
    // Poll getUpdates to find recent group chats the bot has been added to
    const res = await $fetch<{
      ok: boolean
      result: Array<{
        update_id: number
        message?: {
          chat?: {
            id: number
            title?: string
            type?: string
          }
        }
        my_chat_member?: {
          chat?: {
            id: number
            title?: string
            type?: string
          }
        }
      }>
    }>(`${TELEGRAM_API}${settings.telegram.botToken}/getUpdates`, {
      params: {
        offset: 0,
        limit: 100,
        allowed_updates: JSON.stringify(['message', 'my_chat_member']),
      },
    })

    if (!res.ok || !res.result?.length) return []

    // Deduplicate groups by chat ID
    const groupMap = new Map<string, { id: string, title: string, type: string }>()

    for (const update of res.result) {
      const chat = update.message?.chat ?? update.my_chat_member?.chat
      if (!chat) continue

      const chatType = chat.type ?? ''
      if (chatType !== 'group' && chatType !== 'supergroup') continue

      const chatId = String(chat.id)
      if (!groupMap.has(chatId)) {
        groupMap.set(chatId, {
          id: chatId,
          title: chat.title ?? `Group ${chatId}`,
          type: chatType,
        })
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => a.title.localeCompare(b.title))
  } catch (err) {
    if (import.meta.dev) console.error('[telegram-groups] discovery error:', err)
    return []
  }
})
