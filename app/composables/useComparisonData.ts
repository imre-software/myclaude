import type { DailyActivityEntry } from '~/types/stats'

function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface PeriodTotals {
  tokens: number
  cost: number
  sessions: number
  messages: number
}

interface PeriodChanges {
  tokens: number | null
  cost: number | null
  sessions: number | null
  messages: number | null
}

interface ComparisonChartEntry {
  day: string
  current: number
  previous: number
}

function aggregateTotals(days: DailyActivityEntry[]): PeriodTotals {
  return {
    tokens: days.reduce((sum, d) => sum + d.totalTokens, 0),
    cost: days.reduce((sum, d) => sum + d.totalCost, 0),
    sessions: days.reduce((sum, d) => sum + d.sessionCount, 0),
    messages: days.reduce((sum, d) => sum + d.messageCount, 0),
  }
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

export function useComparisonData() {
  const store = useStatsStore()

  const canCompare = computed(() => store.dateRange.preset !== 'all')

  const previousDateRange = computed<{ start: string, end: string } | null>(() => {
    if (!canCompare.value) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (store.dateRange.preset === 'today') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        start: localDateStr(yesterday),
        end: localDateStr(yesterday),
      }
    }

    if (store.dateRange.preset === 'custom') {
      if (!store.dateRange.start || !store.dateRange.end) return null
      const start = new Date(store.dateRange.start)
      const end = new Date(store.dateRange.end)
      const durationMs = end.getTime() - start.getTime() + 86400000 // inclusive
      const prevEnd = new Date(start.getTime() - 86400000)
      const prevStart = new Date(prevEnd.getTime() - durationMs + 86400000)
      return {
        start: localDateStr(prevStart),
        end: localDateStr(prevEnd),
      }
    }

    // Preset: 7d, 14d, 30d
    const daysMap = { '7d': 7, '14d': 14, '30d': 30 } as const
    const days = daysMap[store.dateRange.preset as keyof typeof daysMap]
    if (!days) return null

    const currentEnd = new Date(today)
    const currentStart = new Date(today)
    currentStart.setDate(currentStart.getDate() - days)

    const prevEnd = new Date(currentStart)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - days + 1)

    return {
      start: localDateStr(prevStart),
      end: localDateStr(prevEnd),
    }
  })

  const currentPeriod = computed<DailyActivityEntry[]>(() => {
    return store.filteredDaily
  })

  const previousPeriod = computed<DailyActivityEntry[]>(() => {
    if (!previousDateRange.value || !store.daily) return []
    const { start, end } = previousDateRange.value
    return store.daily.filter(d => d.date >= start && d.date <= end)
  })

  const currentTotals = computed<PeriodTotals>(() => aggregateTotals(currentPeriod.value))
  const previousTotals = computed<PeriodTotals>(() => aggregateTotals(previousPeriod.value))

  const changes = computed<PeriodChanges>(() => ({
    tokens: calcChange(currentTotals.value.tokens, previousTotals.value.tokens),
    cost: calcChange(currentTotals.value.cost, previousTotals.value.cost),
    sessions: calcChange(currentTotals.value.sessions, previousTotals.value.sessions),
    messages: calcChange(currentTotals.value.messages, previousTotals.value.messages),
  }))

  const chartData = computed<Record<'messages' | 'cost', ComparisonChartEntry[]>>(() => {
    const current = currentPeriod.value
    const previous = previousPeriod.value
    const maxLen = Math.max(current.length, previous.length)

    const build = (metric: 'messages' | 'cost'): ComparisonChartEntry[] => {
      const entries: ComparisonChartEntry[] = []
      for (let i = 0; i < maxLen; i++) {
        entries.push({
          day: `Day ${i + 1}`,
          current: metric === 'messages'
            ? (current[i]?.messageCount ?? 0)
            : (current[i]?.totalCost ?? 0),
          previous: metric === 'messages'
            ? (previous[i]?.messageCount ?? 0)
            : (previous[i]?.totalCost ?? 0),
        })
      }
      return entries
    }

    return {
      messages: build('messages'),
      cost: build('cost'),
    }
  })

  const currentDateLabel = computed(() => {
    if (!canCompare.value) return ''
    const days = currentPeriod.value
    if (days.length === 0) return ''
    return `${formatDate(days[0].date)} - ${formatDate(days[days.length - 1].date)}`
  })

  const previousDateLabel = computed(() => {
    if (!previousDateRange.value) return ''
    return `${formatDate(previousDateRange.value.start)} - ${formatDate(previousDateRange.value.end)}`
  })

  return {
    canCompare,
    previousDateRange,
    currentPeriod,
    previousPeriod,
    currentTotals,
    previousTotals,
    changes,
    chartData,
    currentDateLabel,
    previousDateLabel,
  }
}
