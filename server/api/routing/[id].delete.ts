export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid rule ID' })
  }

  deleteRoutingRule(id)
  return { ok: true }
})
