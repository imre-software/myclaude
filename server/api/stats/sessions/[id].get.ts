import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { SessionDetail } from '~~/app/types/stats'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

export default defineEventHandler(async (event): Promise<SessionDetail> => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Session ID required' })
  }

  // Search for the JSONL file matching this session ID across all project dirs
  const projectDirs = await readdir(PROJECTS_DIR).catch(() => [] as string[])

  for (const projectDir of projectDirs) {
    const dirPath = join(PROJECTS_DIR, projectDir)
    const fileName = `${id}.jsonl`
    const filePath = join(dirPath, fileName)

    try {
      const parsed = await parseSessionJsonl(filePath)
      if (parsed && parsed.sessionId === id) {
        const costResult = calculateCost(parsed.model || 'claude-sonnet-4-6', {
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          cacheReadTokens: parsed.cacheReadTokens,
          cacheWriteTokens: parsed.cacheWriteTokens,
        })

        return {
          sessionId: parsed.sessionId,
          project: projectDirToName(projectDir),
          projectPath: projectDirToPath(projectDir),
          startTime: parsed.startTime,
          messageCount: parsed.messageCount,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          cacheReadTokens: parsed.cacheReadTokens,
          cacheWriteTokens: parsed.cacheWriteTokens,
          totalCost: costResult.totalCost,
          model: parsed.model,
          duration: parsed.duration,
          messages: parsed.messages,
        }
      }
    } catch {
      // File doesn't exist in this project dir, continue
    }
  }

  throw createError({ statusCode: 404, statusMessage: 'Session not found' })
})
