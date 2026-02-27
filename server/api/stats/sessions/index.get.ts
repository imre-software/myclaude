export default defineEventHandler(async (event) => {
  await syncSessionDb()

  const query = getQuery(event)

  return querySessions({
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 25,
    sort: String(query.sort || 'startTime'),
    order: String(query.order || 'desc'),
    model: query.model ? String(query.model) : undefined,
    project: query.project ? String(query.project) : undefined,
  })
})
