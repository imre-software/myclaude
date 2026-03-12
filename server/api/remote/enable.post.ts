export default defineEventHandler(async () => {
  const settings = getNotificationSettings()
  settings.remoteMode.enabled = true
  saveNotificationSettings(settings)

  // Install hooks based on current toggle state
  await installRemoteHooks(settings.remoteMode.hooks)

  // Start telegram polling if telegram channel is enabled
  if (settings.remoteMode.channels.telegram && settings.telegram.botToken && settings.telegram.chatId) {
    startTelegramPolling()
  }

  return { ok: true }
})
