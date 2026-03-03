import { getMcpServers } from '~~/server/utils/claudeConfig'
import { discoverMcpTools } from '~~/server/utils/mcpDiscover'
import type { McpToolInfo } from '~~/server/utils/mcpDiscover'

// In-memory cache: server name -> { tools, timestamp }
const cache = new Map<string, { tools: McpToolInfo[], ts: number }>()
const CACHE_TTL = 60_000 // 1 minute

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const serverName = query.server as string | undefined

  if (!serverName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing server query param' })
  }

  const cached = cache.get(serverName)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.tools
  }

  const servers = await getMcpServers()
  const server = servers.find(s => s.name === serverName)

  if (!server) {
    throw createError({ statusCode: 404, statusMessage: `MCP server "${serverName}" not found` })
  }

  const tools = await discoverMcpTools(server)
  cache.set(serverName, { tools, ts: Date.now() })

  return tools
})
