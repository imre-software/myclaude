export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const id = insertNotification({
    type: body.type,
    windowType: body.windowType ?? null,
    thresholdLevel: body.thresholdLevel ?? null,
    title: body.title,
    body: body.body,
    utilization: body.utilization ?? null,
  })
  return { id }
})
