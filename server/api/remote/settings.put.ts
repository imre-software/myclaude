export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body) {
    throw createError({ statusCode: 400, message: 'Missing body' })
  }

  const settings = getNotificationSettings()

  if (body.hooks) {
    settings.remoteMode.hooks = { ...settings.remoteMode.hooks, ...body.hooks }
  }
  if (body.channels) {
    settings.remoteMode.channels = { ...settings.remoteMode.channels, ...body.channels }
  }
  if (body.timeoutMinutes !== undefined) {
    settings.remoteMode.timeoutMinutes = body.timeoutMinutes
  }

  saveNotificationSettings(settings)

  // Re-install hooks if remote mode is enabled (to sync hook toggles)
  if (settings.remoteMode.enabled) {
    await installRemoteHooks(settings.remoteMode.hooks)
  }

  return { ok: true }
})
