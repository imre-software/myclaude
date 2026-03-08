export interface PaceWindowInfo {
  key: string
  label: string
  utilization: number | null
  resetsAt: string | null
  ratePerHour: number | null
  exhaustsAt: string | null
  willExhaust: boolean
  status: 'on-track' | 'warning' | 'critical'
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

export default defineEventHandler(async (): Promise<PaceApiResponse> => {
  const rateLimits = await fetchRateLimits()

  const windowKeys: Array<{ key: string, getData: () => { utilization: number, resetsAt: string | null } | null }> = [
    { key: 'fiveHour', getData: () => rateLimits?.fiveHour ?? null },
    { key: 'sevenDay', getData: () => rateLimits?.sevenDay ?? null },
    { key: 'sevenDaySonnet', getData: () => rateLimits?.sevenDaySonnet ?? null },
    { key: 'sevenDayOpus', getData: () => rateLimits?.sevenDayOpus ?? null },
  ]

  const windows: PaceWindowInfo[] = []

  for (const { key, getData } of windowKeys) {
    const live = getData()

    if (!live) continue

    const pace = calculatePace(key, live.utilization, live.resetsAt)

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
    })
  }

  return { windows }
})
