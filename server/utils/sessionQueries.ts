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

export interface DateFilter {
  from?: string | null
  to?: string | null
}

function buildDateConditions(filter: DateFilter): { conditions: string[], params: string[] } {
  const conditions: string[] = []
  const params: string[] = []
  if (filter.from) {
    conditions.push("strftime('%Y-%m-%d', start_time, 'localtime') >= ?")
    params.push(filter.from)
  }
  if (filter.to) {
    conditions.push("strftime('%Y-%m-%d', start_time, 'localtime') <= ?")
    params.push(filter.to)
  }
  return { conditions, params }
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

export function queryAllSessions(filter?: DateFilter): SessionSummary[] {
  const db = getDb()
  const conditions = ['message_count >= 2']
  const params: string[] = []

  if (filter) {
    const df = buildDateConditions(filter)
    conditions.push(...df.conditions)
    params.push(...df.params)
  }

  const rows = db.prepare(
    `SELECT * FROM sessions WHERE ${conditions.join(' AND ')} ORDER BY start_time DESC`,
  ).all(...params) as SessionRow[]
  return rows.map(rowToSummary)
}

interface QuerySessionsOptions {
  model?: string
  project?: string
  sort?: string
  order?: string
  page?: number
  limit?: number
  from?: string
  to?: string
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

  const df = buildDateConditions({ from: opts.from, to: opts.to })
  conditions.push(...df.conditions)
  params.push(...df.params)

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
      strftime('%Y-%m-%d', start_time, 'localtime') as date,
      COUNT(*) as session_count,
      SUM(message_count) as message_count,
      SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) as total_tokens
    FROM sessions
    WHERE message_count >= 2 AND start_time IS NOT NULL
    GROUP BY strftime('%Y-%m-%d', start_time, 'localtime')
    ORDER BY date ASC
  `).all() as DailyActivityRow[]

  return rows.map(r => ({
    date: r.date,
    sessionCount: r.session_count,
    messageCount: r.message_count,
    totalTokens: r.total_tokens,
  }))
}

export function queryHourlyActivityByDate(): { date: string, hour: number, sessionCount: number }[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      strftime('%Y-%m-%d', start_time, 'localtime') as date,
      CAST(strftime('%H', start_time, 'localtime') AS INTEGER) as hour,
      COUNT(*) as sessionCount
    FROM sessions
    WHERE message_count >= 2 AND start_time IS NOT NULL
    GROUP BY strftime('%Y-%m-%d', start_time, 'localtime'), CAST(strftime('%H', start_time, 'localtime') AS INTEGER)
    ORDER BY date ASC, hour ASC
  `).all() as { date: string, hour: number, sessionCount: number }[]
}

export function queryApiDailyCosts(): DailyCostRow[] {
  const db = getDb()
  return db.prepare('SELECT date, model, cost FROM api_daily_costs ORDER BY date ASC').all() as DailyCostRow[]
}

export function queryDailyTokensByModel(): Map<string, Record<string, number>> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', start_time, 'localtime') as date,
      model,
      SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) as tokens
    FROM sessions
    WHERE message_count >= 2 AND start_time IS NOT NULL AND model IS NOT NULL
    GROUP BY strftime('%Y-%m-%d', start_time, 'localtime'), model
    ORDER BY date ASC
  `).all() as { date: string, model: string, tokens: number }[]

  const result = new Map<string, Record<string, number>>()
  for (const row of rows) {
    let entry = result.get(row.date)
    if (!entry) {
      entry = {}
      result.set(row.date, entry)
    }
    entry[row.model] = (entry[row.model] ?? 0) + row.tokens
  }
  return result
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
