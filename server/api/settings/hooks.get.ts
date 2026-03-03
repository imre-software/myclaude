import { getHooks } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async () => {
  return getHooks()
})
