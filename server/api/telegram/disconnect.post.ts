export default defineEventHandler(() => {
  disconnectTelegram()
  return { ok: true }
})
