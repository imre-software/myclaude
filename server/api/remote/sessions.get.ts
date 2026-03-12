export default defineEventHandler(async () => {
  const sessions = await discoverClaudeSessions()
  return sessions
})
