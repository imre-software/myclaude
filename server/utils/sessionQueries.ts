import type { SessionSummary } from '~~/app/types/stats'

interface DailyCostRow {
  date: string
  model: string
  cost: number
}

interface DailyCostEntry {
  date: string
  costByModel: Record<string, number>
  totalCost: number
}

interface SessionRow {
  file_path: string
  project_dir: string
  session_id: string
  project: string
  project_path: string
  start_time: string | null
  message_count: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  total_cost: number
  model: string
  duration: number
}

function rowToSummary(row: SessionRow): SessionSummary {
  return {
    sessionId: row.session_id,
    project: row.project,
    projectPath: row.project_path,
    startTime: row.start_time ?? '',
    messageCount: row.message_count,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    totalCost: row.total_cost,
    model: row.model,
    duration: row.duration,
  }
}

export function queryAllSessions(): SessionSummary[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM sessions WHERE message_count >= 2 ORDER BY start_time DESC',
  ).all() as SessionRow[]
  return rows.map(rowToSummary)
}

interface QuerySessionsOptions {
  model?: string
  project?: string
  sort?: string
  order?: string
  page?: number
  limit?: number
}

export function querySessions(opts: QuerySessionsOptions) {
  const db = getDb()
  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 25, 100)
  const offset = (page - 1) * limit

  // Whitelist of sortable columns
  const sortableColumns: Record<string, string> = {
    startTime: 'start_time',
    totalCost: 'total_cost',
    messageCount: 'message_count',
    duration: 'duration',
    model: 'model',
    project: 'project',
    inputTokens: 'input_tokens',
    outputTokens: 'output_tokens',
  }
  const sortCol = sortableColumns[opts.sort ?? 'startTime'] ?? 'start_time'
  const sortDir = opts.order === 'asc' ? 'ASC' : 'DESC'

  const conditions: string[] = ['message_count >= 2']
  const params: (string | number)[] = []

  if (opts.model) {
    conditions.push('model = ?')
    params.push(opts.model)
  }
  if (opts.project) {
    conditions.push('project = ?')
    params.push(opts.project)
  }

  const where = conditions.join(' AND ')

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM sessions WHERE ${where}`,
  ).get(...params) as { total: number }

  const rows = db.prepare(
    `SELECT * FROM sessions WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset) as SessionRow[]

  return {
    items: rows.map(rowToSummary),
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit),
  }
}

interface DailyActivityRow {
  date: string
  session_count: number
  message_count: number
  total_tokens: number
}

export interface DailySessionActivity {
  date: string
  sessionCount: number
  messageCount: number
  totalTokens: number
}

export function queryDailyActivity(): DailySessionActivity[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      SUBSTR(start_time, 1, 10) as date,
      COUNT(*) as session_count,
      SUM(message_count) as message_count,
      SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) as total_tokens
    FROM sessions
    WHERE message_count >= 2 AND start_time IS NOT NULL
    GROUP BY SUBSTR(start_time, 1, 10)
    ORDER BY date ASC
  `).all() as DailyActivityRow[]

  return rows.map(r => ({
    date: r.date,
    sessionCount: r.session_count,
    messageCount: r.message_count,
    totalTokens: r.total_tokens,
  }))
}

export function queryApiDailyCosts(): DailyCostRow[] {
  const db = getDb()
  return db.prepare('SELECT date, model, cost FROM api_daily_costs ORDER BY date ASC').all() as DailyCostRow[]
}

export function queryDailyCosts(): DailyCostEntry[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT date, model, SUM(cost) as cost
    FROM file_daily_costs
    GROUP BY date, model
    ORDER BY date ASC
  `).all() as DailyCostRow[]

  const dateMap = new Map<string, Map<string, number>>()
  for (const row of rows) {
    let modelMap = dateMap.get(row.date)
    if (!modelMap) {
      modelMap = new Map()
      dateMap.set(row.date, modelMap)
    }
    modelMap.set(row.model, (modelMap.get(row.model) ?? 0) + row.cost)
  }

  return Array.from(dateMap.entries()).map(([date, modelMap]) => {
    const costByModel = Object.fromEntries(modelMap)
    const totalCost = Array.from(modelMap.values()).reduce((sum, c) => sum + c, 0)
    return { date, costByModel, totalCost }
  })
}
