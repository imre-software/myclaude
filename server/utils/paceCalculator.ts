export interface PaceProjection {
  currentRatePerHour: number
  exhaustsInHours: number | null
  resetsInHours: number | null
  safeRatePerHour: number | null
  willExhaust: boolean
  status: 'on-track' | 'warning' | 'critical' | 'insufficient-data'
  dataSpanMinutes: number
  snapshotCount: number
}

interface Snapshot {
  utilization: number
  recordedAt: string
}

// Need at least 5 min of data before computing anything
const MIN_SPAN_MINUTES = 5

// Ignore utilization changes smaller than 2% - treats noise as flat
const MIN_UTILIZATION_DELTA = 2

export function calculatePace(
  snapshots: Snapshot[],
  currentUtilization: number,
  resetsAt: string | null,
): PaceProjection {
  const base: PaceProjection = {
    currentRatePerHour: 0,
    exhaustsInHours: null,
    resetsInHours: null,
    safeRatePerHour: null,
    willExhaust: false,
    status: 'insufficient-data',
    dataSpanMinutes: 0,
    snapshotCount: snapshots.length,
  }

  if (snapshots.length < 3) return base

  const first = snapshots[0]!
  const last = snapshots[snapshots.length - 1]!
  const firstTime = new Date(first.recordedAt).getTime()
  const lastTime = new Date(last.recordedAt).getTime()
  const spanHours = (lastTime - firstTime) / 3_600_000

  base.dataSpanMinutes = Math.round(spanHours * 60)

  if (base.dataSpanMinutes < MIN_SPAN_MINUTES) return base

  const delta = last.utilization - first.utilization
  const rate = delta / spanHours

  base.currentRatePerHour = rate

  if (resetsAt) {
    const resetsInMs = new Date(resetsAt).getTime() - Date.now()
    base.resetsInHours = Math.max(0, resetsInMs / 3_600_000)
  }

  // Rate is flat or decreasing, or change too small to be meaningful
  if (rate <= 0 || delta < MIN_UTILIZATION_DELTA) {
    base.status = 'on-track'
    if (base.resetsInHours !== null && base.resetsInHours > 0) {
      base.safeRatePerHour = (100 - currentUtilization) / base.resetsInHours
    }
    return base
  }

  const exhaustsInHours = (100 - currentUtilization) / rate
  base.exhaustsInHours = exhaustsInHours

  if (base.resetsInHours !== null && base.resetsInHours > 0) {
    base.safeRatePerHour = (100 - currentUtilization) / base.resetsInHours
  }

  base.willExhaust = base.resetsInHours !== null && exhaustsInHours < base.resetsInHours

  if (base.willExhaust && exhaustsInHours < 1) {
    base.status = 'critical'
  } else if (base.willExhaust) {
    base.status = 'warning'
  } else {
    base.status = 'on-track'
  }

  return base
}
