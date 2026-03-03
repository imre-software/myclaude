import { getMcpServers } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async () => {
  return getMcpServers()
})
