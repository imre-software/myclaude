import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

interface DiskFile {
  path: string
  projectDir: string
  mtime: number
}

export interface SyncProgress {
  status: 'idle' | 'scanning' | 'syncing' | 'done'
  total: number
  processed: number
}

export const syncProgress: SyncProgress = {
  status: 'idle',
  total: 0,
  processed: 0,
}

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

let syncPromise: Promise<void> | null = null

export async function syncSessionDb(): Promise<void> {
  if (syncPromise) return syncPromise

  syncPromise = doSync()
  try {
    await syncPromise
  } finally {
    syncPromise = null
  }
}

async function scanDiskFiles(): Promise<DiskFile[]> {
  const results: DiskFile[] = []

  let projectDirs: string[]
  try {
    projectDirs = await readdir(PROJECTS_DIR)
  } catch {
    return results
  }

  const dirPromises = projectDirs.map(async (projectDir) => {
    const projectPath = join(PROJECTS_DIR, projectDir)
    const projectStat = await stat(projectPath).catch(() => null)
    if (!projectStat?.isDirectory()) return []

    let entries: string[]
    try {
      entries = await readdir(projectPath)
    } catch {
      return []
    }

    const fileResults: DiskFile[] = []

    // Collect top-level JSONL files and scan for subagent dirs in parallel
    const statPromises: Promise<void>[] = []

    for (const entry of entries) {
      if (entry.endsWith('.jsonl')) {
        const filePath = join(projectPath, entry)
        statPromises.push(
          stat(filePath).then((s) => {
            fileResults.push({ path: filePath, projectDir, mtime: Math.floor(s.mtimeMs) })
          }).catch(() => {}),
        )
      } else {
        // Check for subagents directory
        const subagentsPath = join(projectPath, entry, 'subagents')
        statPromises.push(
          stat(subagentsPath).then(async (s) => {
            if (!s.isDirectory()) return
            const subFiles = await readdir(subagentsPath).catch(() => [] as string[])
            const subPromises = subFiles
              .filter(f => f.endsWith('.jsonl'))
              .map(subFile =>
                stat(join(subagentsPath, subFile)).then((fs) => {
                  fileResults.push({
                    path: join(subagentsPath, subFile),
                    projectDir,
                    mtime: Math.floor(fs.mtimeMs),
                  })
                }).catch(() => {}),
              )
            await Promise.all(subPromises)
          }).catch(() => {}),
        )
      }
    }

    await Promise.all(statPromises)
    return fileResults
  })

  const allResults = await Promise.all(dirPromises)
  for (const batch of allResults) {
    results.push(...batch)
  }

  return results
}

async function doSync(): Promise<void> {
  const db = getDb()

  syncProgress.status = 'scanning'
  syncProgress.total = 0
  syncProgress.processed = 0

  const diskFiles = await scanDiskFiles()

  // Get existing file mtimes from DB
  const dbRows = db.prepare('SELECT file_path, file_mtime FROM sessions').all() as Array<{ file_path: string, file_mtime: number }>
  const dbMap = new Map(dbRows.map(r => [r.file_path, r.file_mtime]))

  // Find files that are new or modified
  const filesToParse: DiskFile[] = []
  const diskPaths = new Set<string>()

  for (const file of diskFiles) {
    diskPaths.add(file.path)
    const existingMtime = dbMap.get(file.path)
    if (existingMtime === undefined || existingMtime !== file.mtime) {
      filesToParse.push(file)
    }
  }

  // Find files that were removed from disk
  const removedPaths: string[] = []
  for (const dbPath of dbMap.keys()) {
    if (!diskPaths.has(dbPath)) {
      removedPaths.push(dbPath)
    }
  }

  syncProgress.status = 'syncing'
  syncProgress.total = filesToParse.length
  syncProgress.processed = 0

  // Nothing to do - mark done immediately
  if (filesToParse.length === 0 && removedPaths.length === 0) {
    syncProgress.status = 'done'
    return
  }

  // Delete removed files
  if (removedPaths.length > 0) {
    const deleteSession = db.prepare('DELETE FROM sessions WHERE file_path = ?')
    const deleteCosts = db.prepare('DELETE FROM file_daily_costs WHERE file_path = ?')
    const deleteTx = db.transaction((paths: string[]) => {
      for (const p of paths) {
        deleteSession.run(p)
        deleteCosts.run(p)
      }
    })
    deleteTx(removedPaths)
  }

  // Prepare upsert statements
  const upsertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions
      (file_path, project_dir, session_id, project, project_path, start_time,
       message_count, input_tokens, output_tokens, cache_read_tokens,
       cache_write_tokens, total_cost, model, duration, file_mtime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const deleteCostsForFile = db.prepare('DELETE FROM file_daily_costs WHERE file_path = ?')
  const insertCost = db.prepare(`
    INSERT INTO file_daily_costs (file_path, date, model, cost)
    VALUES (?, ?, ?, ?)
  `)

  // Process in batches and commit per batch for progress reporting
  const BATCH_SIZE = 20
  for (let i = 0; i < filesToParse.length; i += BATCH_SIZE) {
    const batch = filesToParse.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const parsed = await parseSessionJsonl(file.path)
        return { file, parsed }
      }),
    )

    const writeTx = db.transaction(() => {
      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        const { file, parsed } = result.value

        if (!parsed || parsed.messageCount < 2) {
          // Remove stale rows if file no longer qualifies
          upsertSession.run(
            file.path, file.projectDir, '', '', '', null,
            0, 0, 0, 0, 0, 0, '', 0, file.mtime,
          )
          deleteCostsForFile.run(file.path)
          continue
        }

        const totalCost = calculateCost(parsed.model || 'claude-sonnet-4-6', {
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          cacheReadTokens: parsed.cacheReadTokens,
          cacheWriteTokens: parsed.cacheWriteTokens,
        })

        upsertSession.run(
          file.path,
          file.projectDir,
          parsed.sessionId,
          projectDirToName(file.projectDir),
          projectDirToPath(file.projectDir),
          parsed.startTime || null,
          parsed.messageCount,
          parsed.inputTokens,
          parsed.outputTokens,
          parsed.cacheReadTokens,
          parsed.cacheWriteTokens,
          totalCost.totalCost,
          parsed.model,
          parsed.duration,
          file.mtime,
        )

        // Rebuild daily costs for this file
        deleteCostsForFile.run(file.path)

        const dayCosts = new Map<string, Map<string, number>>()
        for (const msg of parsed.messages) {
          if (msg.role !== 'assistant' || !msg.timestamp || !msg.cost) continue
          const date = msg.timestamp.slice(0, 10)
          const model = msg.model || parsed.model || 'unknown'
          let dayMap = dayCosts.get(date)
          if (!dayMap) {
            dayMap = new Map()
            dayCosts.set(date, dayMap)
          }
          dayMap.set(model, (dayMap.get(model) ?? 0) + msg.cost)
        }

        for (const [date, modelMap] of dayCosts) {
          for (const [model, cost] of modelMap) {
            insertCost.run(file.path, date, model, cost)
          }
        }
      }
    })

    writeTx()
    syncProgress.processed = Math.min(i + batch.length, filesToParse.length)
  }

  syncProgress.status = 'done'
}
