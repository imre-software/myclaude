export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const current = getNotificationSettings()
  const merged = { ...current, ...body }

  if (body.thresholds) {
    merged.thresholds = { ...current.thresholds, ...body.thresholds }
  }
  if (body.paceAlerts) {
    merged.paceAlerts = { ...current.paceAlerts, ...body.paceAlerts }
  }
  if (body.quietHours) {
    merged.quietHours = { ...current.quietHours, ...body.quietHours }
  }

  saveNotificationSettings(merged)
  return merged
})
