import { saveAgent } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await saveAgent(body.scope ?? 'user', body.filename, body.content)
  return { ok: true }
})
