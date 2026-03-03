import { deleteAgent } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await deleteAgent(body.scope ?? 'user', body.filename)
  return { ok: true }
})
