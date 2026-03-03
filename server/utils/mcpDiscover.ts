import { spawn } from 'node:child_process'
import type { McpServer } from '~~/app/types/settings'

export interface McpToolInfo {
  name: string
  description?: string
}

interface JsonRpcResponse {
  jsonrpc: string
  id: number | string
  result?: {
    protocolVersion?: string
    sessionId?: string
    tools?: Array<{ name: string, description?: string }>
  }
  error?: { code: number, message: string }
}

/**
 * Discover tools from an MCP server.
 * Supports both stdio (spawn process) and HTTP (POST JSON-RPC) transports.
 */
export async function discoverMcpTools(server: McpServer, timeoutMs = 10_000): Promise<McpToolInfo[]> {
  if (server.type === 'stdio' && server.command) {
    return discoverStdio(server, timeoutMs)
  }
  if ((server.type === 'http' || server.type === 'sse') && server.url) {
    return discoverHttp(server, timeoutMs)
  }
  return []
}

function extractTools(data: JsonRpcResponse): McpToolInfo[] {
  if (!data.result?.tools) return []
  return data.result.tools.map(t => ({
    name: t.name,
    description: t.description,
  }))
}

// HTTP/SSE transport: POST JSON-RPC to the server URL
async function discoverHttp(server: McpServer, timeoutMs: number): Promise<McpToolInfo[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    ...server.headers,
  }

  try {
    // Step 1: Initialize
    const initRes = await fetch(server.url!, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'claude-command', version: '1.0' },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    // Extract session ID if present
    const sessionId = initRes.headers.get('mcp-session-id')
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId
    }

    // Parse init response - handle both JSON and SSE
    const initData = await parseHttpResponse(initRes)
    if (!initData?.result?.protocolVersion) return []

    // Send initialized notification
    await fetch(server.url!, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    // Step 2: List tools
    const toolsRes = await fetch(server.url!, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    const toolsData = await parseHttpResponse(toolsRes)
    if (!toolsData) return []

    return extractTools(toolsData)
  } catch {
    return []
  }
}

// Parse HTTP response - handles both application/json and text/event-stream
async function parseHttpResponse(res: Response): Promise<JsonRpcResponse | null> {
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return res.json()
  }

  if (contentType.includes('text/event-stream')) {
    const text = await res.text()
    // Parse SSE: find lines starting with "data: " and extract JSON
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          return JSON.parse(line.slice(6))
        } catch {
          continue
        }
      }
    }
  }

  return null
}

// Stdio transport: spawn process and communicate via stdin/stdout
function discoverStdio(server: McpServer, timeoutMs: number): Promise<McpToolInfo[]> {
  return new Promise((resolve) => {
    const proc = spawn(server.command!, server.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...server.env },
    })

    let buffer = ''
    let msgId = 0
    let initialized = false
    const timer = setTimeout(() => cleanup([]), timeoutMs)

    function cleanup(result: McpToolInfo[]) {
      clearTimeout(timer)
      proc.stdin.end()
      proc.kill()
      resolve(result)
    }

    function send(method: string, params: Record<string, unknown> = {}) {
      msgId++
      const msg = JSON.stringify({ jsonrpc: '2.0', id: msgId, method, params })
      proc.stdin.write(msg + '\n')
    }

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        let msg: JsonRpcResponse
        try {
          msg = JSON.parse(trimmed)
        } catch {
          continue
        }

        if (!initialized && msg.result?.protocolVersion) {
          initialized = true
          proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
          send('tools/list')
        } else if (initialized && msg.result?.tools) {
          cleanup(extractTools(msg))
        } else if (msg.error) {
          cleanup([])
        }
      }
    })

    proc.on('error', () => cleanup([]))
    proc.on('exit', () => {
      clearTimeout(timer)
      resolve([])
    })

    send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'claude-command', version: '1.0' },
    })
  })
}
