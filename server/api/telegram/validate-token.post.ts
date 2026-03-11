export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string }>(event)

  if (!body?.token) {
    throw createError({ statusCode: 400, message: 'token is required' })
  }

  const botInfo = await validateTelegramToken(body.token)
  return { ok: true, bot: botInfo }
})
