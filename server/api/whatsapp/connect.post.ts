export default defineEventHandler(async (event) => {
  const body = await readBody<{ phoneNumber: string }>(event)

  if (!body?.phoneNumber) {
    throw createError({ statusCode: 400, message: 'phoneNumber is required' })
  }

  const settings = getNotificationSettings()
  settings.whatsapp.phoneNumber = body.phoneNumber
  settings.whatsapp.enabled = true
  saveNotificationSettings(settings)

  connectWhatsApp()

  return { ok: true }
})
