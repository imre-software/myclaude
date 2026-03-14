export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projectName: string
    telegramChatId?: string | null
    telegramChatTitle?: string | null
    whatsappJid?: string | null
    whatsappName?: string | null
    whatsappPictureUrl?: string | null
    enabled?: boolean
  }>(event)

  if (!body?.projectName) {
    throw createError({ statusCode: 400, message: 'projectName is required' })
  }

  const rule = upsertRoutingRule({
    projectName: body.projectName,
    telegramChatId: body.telegramChatId,
    telegramChatTitle: body.telegramChatTitle,
    whatsappJid: body.whatsappJid,
    whatsappName: body.whatsappName,
    whatsappPictureUrl: body.whatsappPictureUrl,
    enabled: body.enabled,
  })

  return rule
})
