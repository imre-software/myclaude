export default defineEventHandler(async () => {
  const settings = getNotificationSettings()

  if (!settings.telegram.botToken || !settings.telegram.chatId) {
    throw createError({ statusCode: 400, message: 'Telegram not configured' })
  }

  const text = '*Test Message*\nTelegram notifications from My Claude are working\\.\n_My Claude_'
  const sent = await sendTelegramMessage(settings.telegram.botToken, settings.telegram.chatId, text)

  return { ok: sent }
})
