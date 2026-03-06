export default defineEventHandler((event) => {
  const query = getQuery(event)
  const limit = Number(query.limit) || 50
  return getNotificationHistory(limit)
})
