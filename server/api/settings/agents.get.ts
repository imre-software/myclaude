import { getAgents } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async () => {
  return getAgents()
})
