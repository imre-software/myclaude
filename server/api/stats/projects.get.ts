import type { ProjectStats } from '~~/app/types/stats'

export default defineEventHandler(async (): Promise<ProjectStats[]> => {
  await syncSessionDb()
  const sessions = queryAllSessions()

  // Group sessions by project
  const projectMap = new Map<string, {
    path: string
    sessionCount: number
    messageCount: number
    totalTokens: number
    totalCost: number
    lastActive: string
    models: Set<string>
  }>()

  for (const session of sessions) {
    const name = session.project || 'Unknown'
    const existing = projectMap.get(name)

    const sessionTokens = session.inputTokens + session.outputTokens
      + session.cacheReadTokens + session.cacheWriteTokens

    if (existing) {
      existing.sessionCount++
      existing.messageCount += session.messageCount
      existing.totalTokens += sessionTokens
      existing.totalCost += session.totalCost
      if (session.startTime > existing.lastActive) {
        existing.lastActive = session.startTime
      }
      if (session.model) existing.models.add(session.model)
    } else {
      projectMap.set(name, {
        path: session.projectPath,
        sessionCount: 1,
        messageCount: session.messageCount,
        totalTokens: sessionTokens,
        totalCost: session.totalCost,
        lastActive: session.startTime,
        models: new Set(session.model ? [session.model] : []),
      })
    }
  }

  const projects: ProjectStats[] = Array.from(projectMap.entries()).map(([name, data]) => ({
    name,
    path: data.path,
    sessionCount: data.sessionCount,
    messageCount: data.messageCount,
    totalTokens: data.totalTokens,
    totalCost: data.totalCost,
    lastActive: data.lastActive,
    models: Array.from(data.models),
  }))

  // Sort by total cost descending
  projects.sort((a, b) => b.totalCost - a.totalCost)

  return projects
})
