import { removeMcpServer } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await removeMcpServer(body.name)
  return { ok: true }
})
