// Stats cache raw data shapes
export interface DailyActivity {
  date: string
  messageCount: number
  sessionCount: number
  toolCallCount: number
}

export interface DailyModelTokens {
  date: string
  tokensByModel: Record<string, number>
}

export interface ModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
  contextWindow: number
  maxOutputTokens: number
}

export interface LongestSession {
  sessionId: string
  duration: number
  messageCount: number
  timestamp: string
}

export interface StatsCache {
  version: number
  lastComputedDate: string
  dailyActivity: DailyActivity[]
  dailyModelTokens: DailyModelTokens[]
  modelUsage: Record<string, ModelUsage>
  totalSessions: number
  totalMessages: number
  longestSession: LongestSession
  firstSessionDate: string
  hourCounts: Record<string, number>
  totalSpeculationTimeSavedMs: number
}

// API response shapes
export interface OverviewResponse {
  totalTokens: number
  totalCost: number
  totalSessions: number
  totalMessages: number
  firstSessionDate: string
  lastComputedDate: string
  modelBreakdown: ModelCostEntry[]
}

export interface ModelCostEntry {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  totalCost: number
  totalTokens: number
}

export interface DailyActivityEntry {
  date: string
  messageCount: number
  sessionCount: number
  toolCallCount: number
  tokensByModel: Record<string, number>
  totalTokens: number
  costByModel: Record<string, number>
  totalCost: number
}

export interface HourlyEntry {
  hour: number
  sessionCount: number
}

// Session types
export interface SessionSummary {
  sessionId: string
  project: string
  projectPath: string
  startTime: string
  messageCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalCost: number
  model: string
  duration: number
}

export interface SessionMessage {
  timestamp: string
  role: 'user' | 'assistant'
  model?: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  cost?: number
  toolCalls?: number
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[]
}

// Project types
export interface ProjectStats {
  name: string
  path: string
  sessionCount: number
  messageCount: number
  totalTokens: number
  totalCost: number
  lastActive: string
  models: string[]
}

// Filter types
export type DateRangePreset = 'today' | '7d' | '14d' | '30d' | 'all' | 'custom'

export interface DateRange {
  preset: DateRangePreset
  start?: string
  end?: string
}

// Pricing
export interface ModelPricing {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}
