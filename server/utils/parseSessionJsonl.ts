import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { SessionMessage } from '~~/app/types/stats'

interface RawJsonlEntry {
  type: string
  sessionId?: string
  timestamp?: string
  cwd?: string
  message?: {
    role?: string
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    content?: Array<{ type: string }>
  }
}

interface ParsedSession {
  sessionId: string
  project: string
  startTime: string
  model: string
  messages: SessionMessage[]
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  messageCount: number
  duration: number
}

export async function parseSessionJsonl(filePath: string): Promise<ParsedSession | null> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  let sessionId = ''
  let project = ''
  let startTime = ''
  let endTime = ''
  let model = ''
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let messageCount = 0
  const messages: SessionMessage[] = []

  for await (const line of rl) {
    if (!line.trim()) continue

    let entry: RawJsonlEntry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }

    if (entry.type === 'assistant' && entry.message?.usage) {
      if (!sessionId && entry.sessionId) sessionId = entry.sessionId
      if (!project && entry.cwd) project = entry.cwd

      const usage = entry.message.usage
      const msgInputTokens = usage.input_tokens ?? 0
      const msgOutputTokens = usage.output_tokens ?? 0
      const msgCacheRead = usage.cache_read_input_tokens ?? 0
      const msgCacheWrite = usage.cache_creation_input_tokens ?? 0

      inputTokens += msgInputTokens
      outputTokens += msgOutputTokens
      cacheReadTokens += msgCacheRead
      cacheWriteTokens += msgCacheWrite
      messageCount++

      if (entry.message.model) model = entry.message.model

      const timestamp = entry.timestamp ?? ''
      if (!startTime && timestamp) startTime = timestamp
      if (timestamp) endTime = timestamp

      // Count tool use blocks in content
      const toolCalls = entry.message.content?.filter(c => c.type === 'tool_use').length ?? 0

      const msgModel = entry.message.model ?? model
      const costResult = calculateCost(msgModel, {
        inputTokens: msgInputTokens,
        outputTokens: msgOutputTokens,
        cacheReadTokens: msgCacheRead,
        cacheWriteTokens: msgCacheWrite,
      })

      messages.push({
        timestamp,
        role: 'assistant',
        model: msgModel,
        inputTokens: msgInputTokens,
        outputTokens: msgOutputTokens,
        cacheReadTokens: msgCacheRead,
        cacheWriteTokens: msgCacheWrite,
        cost: costResult.totalCost,
        toolCalls,
      })
    } else if (entry.type === 'user') {
      messageCount++
      if (!sessionId && entry.sessionId) sessionId = entry.sessionId
      if (!project && entry.cwd) project = entry.cwd
      if (!startTime && entry.timestamp) startTime = entry.timestamp

      messages.push({
        timestamp: entry.timestamp ?? '',
        role: 'user',
      })
    }
  }

  if (!sessionId) return null

  const start = startTime ? new Date(startTime).getTime() : 0
  const end = endTime ? new Date(endTime).getTime() : 0
  const duration = end > start ? end - start : 0

  return {
    sessionId,
    project,
    startTime,
    model,
    messages,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    messageCount,
    duration,
  }
}
