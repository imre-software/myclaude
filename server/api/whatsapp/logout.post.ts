export default defineEventHandler(() => {
  disconnectWhatsApp(true)

  const settings = getNotificationSettings()
  settings.whatsapp.phoneNumber = ''
  settings.whatsapp.enabled = false
  saveNotificationSettings(settings)

  return { ok: true }
})
