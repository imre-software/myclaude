export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const format = String(query.format || 'csv')

  const dailyActivity = queryDailyActivity()
  const dailyCosts = queryDailyCosts()

  const costByDate = new Map(dailyCosts.map(c => [c.date, c.totalCost]))

  const rows = dailyActivity.map(d => ({
    date: d.date,
    sessions: d.sessionCount,
    messages: d.messageCount,
    totalTokens: d.totalTokens,
    totalCost: costByDate.get(d.date) ?? 0,
  }))

  const filename = `daily-activity-export-${new Date().toISOString().slice(0, 10)}`

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.json"`)
    return rows
  }

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}.csv"`)
  return toCsv(rows)
})
