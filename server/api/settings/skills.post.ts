import { saveSkill } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await saveSkill(body.scope ?? 'user', body.dirname, body.content)
  return { ok: true }
})
