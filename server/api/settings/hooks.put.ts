import { saveHooks } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await saveHooks(body.entries)
  return { ok: true }
})
