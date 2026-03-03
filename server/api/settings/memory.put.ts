import { updateMemoryFile } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await updateMemoryFile(body.path, body.content)
  return { ok: true }
})
