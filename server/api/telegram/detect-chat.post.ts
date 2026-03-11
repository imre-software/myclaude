interface TelegramUpdate {
  message?: {
    chat: {
      id: number
      first_name?: string
      username?: string
    }
    text?: string
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string }>(event)

  if (!body?.token) {
    throw createError({ statusCode: 400, message: 'token is required' })
  }

  const res = await $fetch<{ ok: boolean, result: TelegramUpdate[] }>(
    `https://api.telegram.org/bot${body.token}/getUpdates`,
    { query: { limit: 10, offset: -10 } },
  )

  if (!res.ok || !res.result.length) {
    return { found: false }
  }

  // Find the most recent private message (likely /start)
  const latest = res.result
    .filter(u => u.message?.chat)
    .at(-1)

  if (!latest?.message) {
    return { found: false }
  }

  const { chat } = latest.message
  return {
    found: true,
    chatId: String(chat.id),
    name: chat.first_name || chat.username || '',
  }
})
