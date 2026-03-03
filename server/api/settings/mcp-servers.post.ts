import { addMcpServer } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await addMcpServer(body)
  return { ok: true }
})
