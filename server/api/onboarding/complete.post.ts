export default defineEventHandler(() => {
  const db = getDb()
  db.prepare(
    "INSERT OR REPLACE INTO notification_settings (key, value) VALUES ('onboarding_completed', 'true')",
  ).run()
  return { ok: true }
})
