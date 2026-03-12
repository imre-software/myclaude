export default defineEventHandler(() => {
  const settings = getNotificationSettings()
  const remote = settings.remoteMode
  const pending = getPending()
  const hooksInstalled = isRemoteHooksInstalled()

  return {
    enabled: remote?.enabled ?? false,
    hooks: remote?.hooks ?? { stop: false, permissionRequest: false, notification: false },
    channels: remote?.channels ?? { whatsapp: false, telegram: false },
    timeoutMinutes: remote?.timeoutMinutes ?? 60,
    hooksInstalled,
    telegramPolling: isTelegramPolling(),
    pending: pending
      ? {
          sessionId: pending.sessionId,
          hookEvent: pending.hookEvent,
          elapsedMs: Date.now() - pending.createdAt,
        }
      : null,
  }
})
