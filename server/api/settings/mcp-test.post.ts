import type { McpServer } from '~~/app/types/settings'
import { discoverMcpTools } from '~~/server/utils/mcpDiscover'

export default defineEventHandler(async (event) => {
  const body = await readBody<Partial<McpServer>>(event)

  if (!body?.type) {
    throw createError({ statusCode: 400, statusMessage: 'Missing server type' })
  }

  const server: McpServer = {
    name: body.name ?? 'test',
    type: body.type,
    command: body.command,
    args: body.args,
    env: body.env,
    url: body.url,
    headers: body.headers,
    scope: 'user',
    enabled: true,
  }

  return await discoverMcpTools(server)
})
