export default defineEventHandler(() => {
  disconnectWhatsApp(false)
  return { ok: true }
})
