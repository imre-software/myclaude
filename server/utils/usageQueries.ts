import type { WindowUsage, BurnRate, HourlyUsageEntry } from '~~/app/types/usage'

export function queryWindowUsage(hoursAgo: number): WindowUsage {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COUNT(*) as sessions,
      COALESCE(SUM(message_count), 0) as messages,
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(total_cost), 0) as cost
    FROM sessions
    WHERE message_count >= 2
      AND start_time >= datetime('now', '-${hoursAgo} hours')
  `).get() as {
    sessions: number
    messages: number
    input_tokens: number
    output_tokens: number
    cost: number
  }

  return {
    sessions: row.sessions,
    messages: row.messages,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cost: row.cost,
  }
}

export function queryTodayUsage(): WindowUsage {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COUNT(*) as sessions,
      COALESCE(SUM(message_count), 0) as messages,
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(total_cost), 0) as cost
    FROM sessions
    WHERE message_count >= 2
      AND strftime('%Y-%m-%d', start_time, 'localtime') = strftime('%Y-%m-%d', 'now', 'localtime')
  `).get() as {
    sessions: number
    messages: number
    input_tokens: number
    output_tokens: number
    cost: number
  }

  return {
    sessions: row.sessions,
    messages: row.messages,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cost: row.cost,
  }
}

export function queryMonthUsage(): WindowUsage {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COUNT(*) as sessions,
      COALESCE(SUM(message_count), 0) as messages,
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(total_cost), 0) as cost
    FROM sessions
    WHERE message_count >= 2
      AND strftime('%Y-%m', start_time, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
  `).get() as {
    sessions: number
    messages: number
    input_tokens: number
    output_tokens: number
    cost: number
  }

  return {
    sessions: row.sessions,
    messages: row.messages,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cost: row.cost,
  }
}

export function queryBurnRate(): BurnRate {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(message_count), 0) as total_messages
    FROM sessions
    WHERE message_count >= 2
      AND start_time >= datetime('now', '-5 hours')
  `).get() as {
    total_tokens: number
    total_cost: number
    total_messages: number
  }

  return {
    tokensPerHour: row.total_tokens / 5,
    costPerHour: row.total_cost / 5,
    messagesPerHour: row.total_messages / 5,
  }
}

export function queryTodayHourly(): HourlyUsageEntry[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      CAST(strftime('%H', start_time, 'localtime') AS INTEGER) as hour,
      COALESCE(SUM(message_count), 0) as messages,
      COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
      COALESCE(SUM(total_cost), 0) as cost
    FROM sessions
    WHERE message_count >= 2
      AND strftime('%Y-%m-%d', start_time, 'localtime') = strftime('%Y-%m-%d', 'now', 'localtime')
    GROUP BY CAST(strftime('%H', start_time, 'localtime') AS INTEGER)
    ORDER BY hour ASC
  `).all() as { hour: number, messages: number, tokens: number, cost: number }[]

  return rows
}
