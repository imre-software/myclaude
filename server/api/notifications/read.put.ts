export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (body.id) {
    markNotificationRead(body.id)
  } else {
    markAllNotificationsRead()
  }
  return { ok: true }
})
