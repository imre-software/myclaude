export default defineEventHandler(async () => {
  const settings = getNotificationSettings()

  if (!settings.whatsapp.phoneNumber) {
    throw createError({ statusCode: 400, message: 'No phone number configured' })
  }

  const sent = await sendWhatsAppMessage(
    settings.whatsapp.phoneNumber,
    '*Test Message*\nWhatsApp notifications from My Claude are working.\n_My Claude_',
  )

  return { ok: sent, queued: !sent }
})
