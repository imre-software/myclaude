export default defineEventHandler(async () => {
  const settings = getNotificationSettings()
  settings.remoteMode.enabled = false
  saveNotificationSettings(settings)

  // Remove hooks from Claude settings
  await removeRemoteHooks()

  // Stop telegram polling
  stopTelegramPolling()

  // Cancel any pending request
  cancelPending()

  return { ok: true }
})
