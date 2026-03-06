export interface PaceWindowInfo {
  key: string
  label: string
  utilization: number | null
  resetsAt: string | null
  ratePerHour: number | null
  exhaustsAt: string | null
  willExhaust: boolean
  status: 'on-track' | 'warning' | 'critical' | 'insufficient-data' | 'no-data'
  snapshotCount: number
  dataSpanMinutes: number
}

export interface PaceApiResponse {
  windows: PaceWindowInfo[]
}

const WINDOW_LABELS: Record<string, string> = {
  fiveHour: 'Current session',
  sevenDay: 'Current week (all models)',
  sevenDaySonnet: 'Current week (Sonnet only)',
  sevenDayOpus: 'Current week (Opus only)',
}

export default defineEventHandler((): PaceApiResponse => {
  const rateLimits = getCachedRateLimits()

  const windowKeys: Array<{ key: string, getData: () => { utilization: number, resetsAt: string | null } | null }> = [
    { key: 'fiveHour', getData: () => rateLimits?.fiveHour ?? null },
    { key: 'sevenDay', getData: () => rateLimits?.sevenDay ?? null },
    { key: 'sevenDaySonnet', getData: () => rateLimits?.sevenDaySonnet ?? null },
    { key: 'sevenDayOpus', getData: () => rateLimits?.sevenDayOpus ?? null },
  ]

  const windows: PaceWindowInfo[] = []

  for (const { key, getData } of windowKeys) {
    const live = getData()
    const history = getUtilizationHistory(key)

    const first = history[0]
    const last = history[history.length - 1]
    let spanMinutes = 0
    if (first && last) {
      spanMinutes = Math.round(
        (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / 60_000,
      )
    }

    if (!live) {
      // Only include windows that have either live data or history
      if (history.length > 0) {
        windows.push({
          key,
          label: WINDOW_LABELS[key] ?? key,
          utilization: last?.utilization ?? null,
          resetsAt: last?.resetsAt ?? null,
          ratePerHour: null,
          exhaustsAt: null,
          willExhaust: false,
          status: 'no-data',
          snapshotCount: history.length,
          dataSpanMinutes: spanMinutes,
        })
      }
      continue
    }

    const pace = calculatePace(history, live.utilization, live.resetsAt)

    // Compute exhaustion timestamp
    let exhaustsAt: string | null = null
    if (pace.exhaustsInHours !== null && pace.willExhaust) {
      exhaustsAt = new Date(Date.now() + pace.exhaustsInHours * 3_600_000).toISOString()
    }

    windows.push({
      key,
      label: WINDOW_LABELS[key] ?? key,
      utilization: live.utilization,
      resetsAt: live.resetsAt,
      ratePerHour: pace.currentRatePerHour,
      exhaustsAt,
      willExhaust: pace.willExhaust,
      status: pace.status,
      snapshotCount: history.length,
      dataSpanMinutes: spanMinutes,
    })
  }

  return { windows }
})
