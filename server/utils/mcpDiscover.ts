import { spawn } from 'node:child_process'
import type { McpServer } from '~~/app/types/settings'

export interface McpToolInfo {
  name: string
  description?: string
}

export interface McpDiscoveryError {
  type: 'auth_required' | 'forbidden' | 'connection_error' | 'timeout' | 'server_error' | 'unknown'
  status?: number
  message: string
}

export interface McpDiscoveryResult {
  tools: McpToolInfo[]
  error?: McpDiscoveryError
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
 * Returns structured result with error details instead of silently failing.
 */
export async function discoverMcpTools(server: McpServer, timeoutMs = 10_000): Promise<McpDiscoveryResult> {
  if (server.type === 'stdio' && server.command) {
    return discoverStdio(server, timeoutMs)
  }
  if ((server.type === 'http' || server.type === 'sse') && server.url) {
    return discoverHttp(server, timeoutMs)
  }
  return { tools: [], error: { type: 'unknown', message: 'Invalid server configuration' } }
}

function extractTools(data: JsonRpcResponse): McpToolInfo[] {
  if (!data.result?.tools) return []
  return data.result.tools.map(t => ({
    name: t.name,
    description: t.description,
  }))
}

// HTTP/SSE transport: POST JSON-RPC to the server URL
async function discoverHttp(server: McpServer, timeoutMs: number): Promise<McpDiscoveryResult> {
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

    // Check HTTP status before parsing
    if (initRes.status === 401) {
      return { tools: [], error: { type: 'auth_required', status: 401, message: 'Server requires authentication' } }
    }
    if (initRes.status === 403) {
      return { tools: [], error: { type: 'forbidden', status: 403, message: 'Access denied - invalid or insufficient credentials' } }
    }
    if (initRes.status >= 500) {
      return { tools: [], error: { type: 'server_error', status: initRes.status, message: `Server error (${initRes.status})` } }
    }
    if (!initRes.ok) {
      return { tools: [], error: { type: 'unknown', status: initRes.status, message: `Unexpected response (${initRes.status})` } }
    }

    // Extract session ID if present
    const sessionId = initRes.headers.get('mcp-session-id')
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId
    }

    // Parse init response - handle both JSON and SSE
    const initData = await parseHttpResponse(initRes)

    // Check for JSON-RPC error (servers like Galileo return HTTP 200 with error body)
    if (initData?.error) {
      const msg = initData.error.message ?? 'Server returned an error'
      const lower = msg.toLowerCase()
      const isAuth = lower.includes('auth') || lower.includes('api key') || lower.includes('unauthorized') || lower.includes('token')
      return { tools: [], error: { type: isAuth ? 'auth_required' : 'unknown', message: msg } }
    }

    if (!initData?.result?.protocolVersion) {
      return { tools: [], error: { type: 'unknown', message: 'Invalid MCP response - missing protocol version' } }
    }

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
    if (!toolsData) {
      return { tools: [], error: { type: 'unknown', message: 'Failed to parse tools response' } }
    }

    // Check for JSON-RPC error on tools/list
    if (toolsData.error) {
      const msg = toolsData.error.message ?? 'Failed to list tools'
      const lower = msg.toLowerCase()
      const isAuth = lower.includes('auth') || lower.includes('api key') || lower.includes('unauthorized') || lower.includes('token')
      return { tools: [], error: { type: isAuth ? 'auth_required' : 'unknown', message: msg } }
    }

    return { tools: extractTools(toolsData) }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { tools: [], error: { type: 'timeout', message: 'Connection timed out' } }
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { tools: [], error: { type: 'connection_error', message: `Could not connect to server: ${msg}` } }
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
function discoverStdio(server: McpServer, timeoutMs: number): Promise<McpDiscoveryResult> {
  return new Promise((resolve) => {
    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(server.command!, server.args ?? [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...server.env },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      resolve({ tools: [], error: { type: 'connection_error', message: `Failed to start process: ${msg}` } })
      return
    }

    let buffer = ''
    let stderrBuffer = ''
    let msgId = 0
    let initialized = false
    const timer = setTimeout(() => cleanup({ tools: [], error: { type: 'timeout', message: 'Process timed out' } }), timeoutMs)

    function cleanup(result: McpDiscoveryResult) {
      clearTimeout(timer)
      proc.stdin!.end()
      proc.kill()
      resolve(result)
    }

    function send(method: string, params: Record<string, unknown> = {}) {
      msgId++
      const msg = JSON.stringify({ jsonrpc: '2.0', id: msgId, method, params })
      proc.stdin!.write(msg + '\n')
    }

    proc.stdout!.on('data', (chunk: Buffer) => {
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
          proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
          send('tools/list')
        } else if (initialized && msg.result?.tools) {
          cleanup({ tools: extractTools(msg) })
        } else if (msg.error) {
          cleanup({ tools: [], error: { type: 'unknown', message: msg.error.message } })
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
    })

    proc.on('error', (err) => {
      cleanup({ tools: [], error: { type: 'connection_error', message: err.message } })
    })
    proc.on('exit', (code) => {
      clearTimeout(timer)
      if (code !== 0 && stderrBuffer.trim()) {
        resolve({ tools: [], error: { type: 'connection_error', message: stderrBuffer.trim().slice(0, 500) } })
      } else {
        resolve({ tools: [], error: { type: 'connection_error', message: `Process exited with code ${code}` } })
      }
    })

    send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'claude-command', version: '1.0' },
    })
  })
}
