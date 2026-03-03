import { deleteSkill } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await deleteSkill(body.scope ?? 'user', body.dirname)
  return { ok: true }
})
