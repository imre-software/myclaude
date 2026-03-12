export default defineEventHandler(() => {
  cancelPending()
  return { ok: true }
})
