import type { McpServer } from '~~/app/types/settings'
import { discoverMcpConfig } from '~~/server/utils/claudeGenerate'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string, url: string, type: McpServer['type'] }>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing server name' })
  }

  return await discoverMcpConfig(
    body.name,
    body.url ?? body.name,
    body.type ?? 'http',
  )
})
