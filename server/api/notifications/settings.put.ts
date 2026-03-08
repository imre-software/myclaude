export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const current = getNotificationSettings()
  const merged = { ...current, ...body }

  if (body.thresholds) {
    merged.thresholds = { ...current.thresholds }
    for (const key of Object.keys(body.thresholds) as Array<keyof typeof current.thresholds>) {
      merged.thresholds[key] = { ...current.thresholds[key], ...body.thresholds[key] }
    }
  }
  if (body.paceAlerts) {
    merged.paceAlerts = {
      ...current.paceAlerts,
      ...body.paceAlerts,
      windows: { ...current.paceAlerts.windows, ...body.paceAlerts.windows },
    }
  }
  if (body.quietHours) {
    merged.quietHours = { ...current.quietHours, ...body.quietHours }
  }

  saveNotificationSettings(merged)
  return merged
})
