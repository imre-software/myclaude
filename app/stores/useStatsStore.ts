import type {
  DateRange,
  DailyActivityEntry,
  ModelCostEntry,
  OverviewResponse,
} from '~/types/stats'

interface HourlyByDateEntry {
  date: string
  hour: number
  sessionCount: number
}

type ApiSyncStatus = 'idle' | 'syncing_recent' | 'recent_done' | 'syncing_history' | 'done' | 'skipped'

interface SyncEvent {
  subscriptionType?: 'max' | 'api'
  status: 'idle' | 'scanning' | 'syncing' | 'done'
  total: number
  processed: number
  apiStatus: ApiSyncStatus
  apiWindowsTotal: number
  apiWindowsProcessed: number
}

function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const useStatsStore = defineStore('stats', () => {
  // Subscription type
  const subscriptionType = ref<'max' | 'api'>('max')
  const isMax = computed(() => subscriptionType.value === 'max')
  const isAllTime = computed(() => dateRange.value.preset === 'all')

  // Sync state
  const isSyncing = ref(false)
  const syncTotal = ref(0)
  const syncProcessed = ref(0)
  const syncReady = ref(false)
  const apiSyncStatus = ref<ApiSyncStatus>('idle')
  const apiWindowsTotal = ref(0)
  const apiWindowsProcessed = ref(0)

  // Filter state
  const dateRange = ref<DateRange>({ preset: 'all' })
  const selectedModels = ref<string[]>([])

  // Computed date filter bounds (local timezone)
  const dateStart = computed(() => {
    if (dateRange.value.preset === 'custom' && dateRange.value.start) {
      return dateRange.value.start
    }
    if (dateRange.value.preset === 'all') return null

    const now = new Date()
    if (dateRange.value.preset === 'today') {
      return localDateStr(now)
    }

    const days = dateRange.value.preset === '7d' ? 7
      : dateRange.value.preset === '14d' ? 14
        : 30
    const d = new Date()
    d.setDate(d.getDate() - days)
    return localDateStr(d)
  })

  const dateEnd = computed(() => {
    if (dateRange.value.preset === 'custom' && dateRange.value.end) {
      return dateRange.value.end
    }
    return null
  })

  const hasDateFilter = computed(() => dateStart.value !== null || dateEnd.value !== null)
  const hasModelFilter = computed(() => selectedModels.value.length > 0)
  const hasFilters = computed(() => hasDateFilter.value || hasModelFilter.value)

  // Data fetching - runs immediately during SSR (endpoints call syncSessionDb internally)
  const { data: overview, status: overviewStatus, refresh: refreshOverview } = useFetch<OverviewResponse>('/api/stats/overview')
  const { data: daily, status: dailyStatus, refresh: refreshDaily } = useFetch<DailyActivityEntry[]>('/api/stats/daily')
  const { data: hourlyByDate, refresh: refreshHourly } = useFetch<HourlyByDateEntry[]>('/api/stats/hourly')
  const { data: modelsData, refresh: refreshModels } = useFetch<{
    models: ModelCostEntry[]
    cacheSavings: { actualCost: number, uncachedCost: number, saved: number, savingsPercent: number }
  }>('/api/stats/models')

  function refreshAll() {
    refreshOverview()
    refreshDaily()
    refreshHourly()
    refreshModels()
  }

  function startSync() {
    if (import.meta.server || isSyncing.value) return

    isSyncing.value = true
    const es = new EventSource('/api/stats/sync')

    let recentRefreshed = false

    es.onmessage = (event) => {
      const data: SyncEvent = JSON.parse(event.data)
      if (data.subscriptionType) {
        subscriptionType.value = data.subscriptionType
      }
      syncTotal.value = data.total
      syncProcessed.value = data.processed
      apiSyncStatus.value = data.apiStatus
      apiWindowsTotal.value = data.apiWindowsTotal
      apiWindowsProcessed.value = data.apiWindowsProcessed

      // For Max: refresh when session sync is done (no API phase)
      // For API: refresh when recent billing data is ready
      if (!recentRefreshed) {
        const sessionsDone = data.status === 'done'
        const maxReady = isMax.value && sessionsDone
        const apiReady = !isMax.value && (data.apiStatus === 'recent_done' || data.apiStatus === 'syncing_history')
        if (maxReady || apiReady) {
          recentRefreshed = true
          syncReady.value = true
          refreshAll()
        }
      }

      const allDone = data.status === 'done'
        && (data.apiStatus === 'done' || data.apiStatus === 'skipped')

      if (allDone) {
        es.close()
        isSyncing.value = false
        syncReady.value = true
        // Final refresh with full historical data
        if (data.total > 0 || data.apiWindowsTotal > 0) {
          refreshAll()
        }
      }
    }

    es.onerror = () => {
      es.close()
      isSyncing.value = false
      syncReady.value = true
    }
  }

  function forceSync() {
    if (import.meta.server || isSyncing.value) return
    startSync()
  }

  // Available models (derived from overview data)
  const availableModels = computed(() => {
    if (!overview.value?.modelBreakdown) return []
    return overview.value.modelBreakdown.map(m => m.model)
  })

  // Filtered daily data
  const filteredDaily = computed(() => {
    if (!daily.value) return []
    let data = daily.value

    if (dateStart.value) {
      data = data.filter(d => d.date >= dateStart.value!)
    }
    if (dateEnd.value) {
      data = data.filter(d => d.date <= dateEnd.value!)
    }

    return data
  })

  // Filtered hourly data (aggregate date+hour entries by hour within the date range)
  const filteredHourly = computed(() => {
    if (!hourlyByDate.value) return []

    let data = hourlyByDate.value

    if (dateStart.value) {
      data = data.filter(d => d.date >= dateStart.value!)
    }
    if (dateEnd.value) {
      data = data.filter(d => d.date <= dateEnd.value!)
    }

    // Aggregate by hour across all matching dates
    const hourCounts = new Map<number, number>()
    for (const entry of data) {
      hourCounts.set(entry.hour, (hourCounts.get(entry.hour) ?? 0) + entry.sessionCount)
    }

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      sessionCount: hourCounts.get(hour) ?? 0,
    }))
  })

  // Filtered overview (recompute totals from filtered daily)
  const filteredOverview = computed(() => {
    if (!overview.value) return null

    // If no filters active, return original
    if (!hasFilters.value) {
      return overview.value
    }

    const days = filteredDaily.value
    const totalMessages = days.reduce((sum, d) => sum + d.messageCount, 0)
    const totalTokens = days.reduce((sum, d) => sum + d.totalTokens, 0)
    const totalSessions = days.reduce((sum, d) => sum + d.sessionCount, 0)
    const totalCost = days.reduce((sum, d) => {
      if (!hasModelFilter.value) return sum + d.totalCost
      // When model filter is active, sum only selected models' costs
      let dayCost = 0
      for (const [model, cost] of Object.entries(d.costByModel)) {
        if (selectedModels.value.includes(model)) {
          dayCost += cost
        }
      }
      return sum + dayCost
    }, 0)

    return {
      ...overview.value,
      totalMessages,
      totalTokens,
      totalSessions,
      totalCost,
    }
  })

  // Filtered model data
  const filteredModels = computed(() => {
    if (!modelsData.value) return null

    // When date filter is active, recompute model costs from daily data
    if (hasDateFilter.value) {
      const days = filteredDaily.value

      // Aggregate costs and tokens per model from filtered daily data
      const modelAgg = new Map<string, { totalCost: number, totalTokens: number }>()
      for (const day of days) {
        // Collect all models from both cost and token sources
        const allModels = new Set([
          ...Object.keys(day.costByModel),
          ...Object.keys(day.tokensByModel),
        ])
        for (const model of allModels) {
          const existing = modelAgg.get(model) ?? { totalCost: 0, totalTokens: 0 }
          existing.totalCost += day.costByModel[model] ?? 0
          existing.totalTokens += day.tokensByModel[model] ?? 0
          modelAgg.set(model, existing)
        }
      }

      // Map to ModelCostEntry-like objects, using all-time data for cost breakdown ratios
      const models: ModelCostEntry[] = []
      for (const [model, agg] of modelAgg) {
        // Skip if model filter is active and this model isn't selected
        if (hasModelFilter.value && !selectedModels.value.includes(model)) continue

        // Get the all-time model data for cost breakdown ratios
        const allTimeModel = modelsData.value.models.find(m => m.model === model)
        if (allTimeModel && allTimeModel.totalCost > 0) {
          const ratio = agg.totalCost / allTimeModel.totalCost
          models.push({
            model,
            inputTokens: Math.round(allTimeModel.inputTokens * ratio),
            outputTokens: Math.round(allTimeModel.outputTokens * ratio),
            cacheReadTokens: Math.round(allTimeModel.cacheReadTokens * ratio),
            cacheWriteTokens: Math.round(allTimeModel.cacheWriteTokens * ratio),
            inputCost: allTimeModel.inputCost * ratio,
            outputCost: allTimeModel.outputCost * ratio,
            cacheReadCost: allTimeModel.cacheReadCost * ratio,
            cacheWriteCost: allTimeModel.cacheWriteCost * ratio,
            totalCost: agg.totalCost,
            totalTokens: agg.totalTokens,
          })
        } else {
          models.push({
            model,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            inputCost: 0,
            outputCost: 0,
            cacheReadCost: 0,
            cacheWriteCost: 0,
            totalCost: agg.totalCost,
            totalTokens: agg.totalTokens,
          })
        }
      }

      const actualCost = models.reduce((sum, m) => sum + m.totalCost, 0)

      // Scale cache savings proportionally
      const allTimeCost = modelsData.value.cacheSavings.actualCost
      const savingsRatio = allTimeCost > 0 ? actualCost / allTimeCost : 0
      const uncachedCost = modelsData.value.cacheSavings.uncachedCost * savingsRatio
      const saved = uncachedCost - actualCost

      return {
        models,
        cacheSavings: {
          actualCost,
          uncachedCost,
          saved,
          savingsPercent: uncachedCost > 0 ? (saved / uncachedCost) * 100 : 0,
        },
      }
    }

    // No date filter - apply model filter only
    if (!hasModelFilter.value) return modelsData.value

    const filtered = modelsData.value.models.filter(m =>
      selectedModels.value.includes(m.model),
    )

    const actualCost = filtered.reduce((sum, m) => sum + m.totalCost, 0)
    const uncachedCost = filtered.reduce((sum, m) => {
      const allTimeModel = modelsData.value!.models.find(am => am.model === m.model)
      if (!allTimeModel || allTimeModel.totalCost === 0) return sum
      const ratio = m.totalCost / allTimeModel.totalCost
      return sum + (modelsData.value!.cacheSavings.uncachedCost * ratio)
    }, 0)
    const saved = uncachedCost - actualCost

    return {
      models: filtered,
      cacheSavings: {
        actualCost,
        uncachedCost,
        saved,
        savingsPercent: uncachedCost > 0 ? (saved / uncachedCost) * 100 : 0,
      },
    }
  })

  const isLoading = computed(() =>
    overviewStatus.value === 'pending' || dailyStatus.value === 'pending',
  )

  return {
    // Subscription
    subscriptionType,
    isMax,
    isAllTime,

    // Sync state
    isSyncing,
    syncTotal,
    syncProcessed,
    syncReady,
    apiSyncStatus,
    apiWindowsTotal,
    apiWindowsProcessed,
    startSync,
    forceSync,

    // Filter state
    dateRange,
    selectedModels,
    dateStart,
    dateEnd,

    // Raw data
    overview,
    daily,
    modelsData,

    // Filtered data
    filteredDaily,
    filteredHourly,
    filteredOverview,
    filteredModels,
    availableModels,
    isLoading,
  }
})
