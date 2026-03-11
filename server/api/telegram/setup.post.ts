export default defineEventHandler(async (event) => {
  const body = await readBody<{ botToken: string, chatId: string, botName: string }>(event)

  if (!body?.botToken || !body?.chatId) {
    throw createError({ statusCode: 400, message: 'botToken and chatId are required' })
  }

  const settings = getNotificationSettings()
  settings.telegram.botToken = body.botToken
  settings.telegram.chatId = body.chatId
  settings.telegram.botName = body.botName || ''
  settings.telegram.enabled = true
  saveNotificationSettings(settings)

  connectTelegram()

  return { ok: true }
})
