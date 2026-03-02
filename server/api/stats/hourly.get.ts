export default defineEventHandler(() => {
  const rows = queryHourlyActivityByDate()

  // Return date+hour granularity so the client can filter by date range
  return rows
})
