export default defineEventHandler(async () => {
  const status = getWhatsAppStatus()

  if (status.connection !== 'connected') {
    throw createError({ statusCode: 503, message: 'WhatsApp is not connected' })
  }

  const groups = await getWhatsAppGroups()
  return groups
})
