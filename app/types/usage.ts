export interface RateLimitWindow {
  utilization: number
  resetsAt: string | null
}

export interface RateLimitInfo {
  fiveHour: RateLimitWindow
  sevenDay: RateLimitWindow
  sevenDaySonnet: RateLimitWindow | null
  sevenDayOpus: RateLimitWindow | null
  extraUsage: {
    isEnabled: boolean
    monthlyLimit: number | null
    usedCredits: number | null
    utilization: number | null
  } | null
}

export interface WindowUsage {
  sessions: number
  messages: number
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface BurnRate {
  tokensPerHour: number
  costPerHour: number
  messagesPerHour: number
}

export interface HourlyUsageEntry {
  hour: number
  messages: number
  tokens: number
  cost: number
}

export interface ContextItem {
  name: string
  tokens: number
}

export interface ContextCategory {
  label: string
  slug: string
  tokens: number
  percentage: number
  items: ContextItem[]
}

export interface ContextBreakdown {
  model: string
  totalContextWindow: number
  usedTokens: number
  usedPercentage: number
  categories: ContextCategory[]
  freeSpace: number
  freeSpacePercentage: number
  autocompactBuffer: number
  autocompactPercentage: number
}

export interface UsageResponse {
  rateLimits: RateLimitInfo | null
  windows: {
    fiveHour: WindowUsage
    sevenDay: WindowUsage
    today: WindowUsage
    month: WindowUsage
  }
  burnRate: BurnRate
  hourly: HourlyUsageEntry[]
  context: ContextBreakdown
}
