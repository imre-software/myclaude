import { getMcpServers } from '~~/server/utils/claudeConfig'
import { discoverMcpTools } from '~~/server/utils/mcpDiscover'
import type { McpDiscoveryResult } from '~~/server/utils/mcpDiscover'

// In-memory cache: server name -> { result, timestamp }
const cache = new Map<string, { result: McpDiscoveryResult, ts: number }>()
const CACHE_TTL = 60_000 // 1 minute

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const serverName = query.server as string | undefined

  if (!serverName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing server query param' })
  }

  const cached = cache.get(serverName)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.result
  }

  const servers = await getMcpServers()
  const server = servers.find(s => s.name === serverName)

  if (!server) {
    throw createError({ statusCode: 404, statusMessage: `MCP server "${serverName}" not found` })
  }

  const result = await discoverMcpTools(server)
  cache.set(serverName, { result, ts: Date.now() })

  return result
})
