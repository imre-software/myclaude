export interface PaceProjection {
  currentRatePerHour: number
  projectedAtReset: number
  exhaustsInHours: number | null
  resetsInHours: number | null
  safeRatePerHour: number | null
  willExhaust: boolean
  status: 'on-track' | 'warning' | 'critical'
}

const WINDOW_DURATIONS: Record<string, number> = {
  fiveHour: 5,
  sevenDay: 168,
  sevenDaySonnet: 168,
  sevenDayOpus: 168,
}

export function calculatePace(
  windowKey: string,
  currentUtilization: number,
  resetsAt: string | null,
): PaceProjection {
  const base: PaceProjection = {
    currentRatePerHour: 0,
    projectedAtReset: currentUtilization,
    exhaustsInHours: null,
    resetsInHours: null,
    safeRatePerHour: null,
    willExhaust: false,
    status: 'on-track',
  }

  if (!resetsAt) return base

  const resetsInMs = new Date(resetsAt).getTime() - Date.now()
  const resetsInHours = Math.max(0, resetsInMs / 3_600_000)
  base.resetsInHours = resetsInHours

  const windowHours = WINDOW_DURATIONS[windowKey] ?? 168
  const elapsedHours = windowHours - resetsInHours

  if (elapsedHours <= 0) return base

  // Rate = how fast we've been consuming so far in this window
  const rate = currentUtilization / elapsedHours
  base.currentRatePerHour = rate

  // Projected usage when the window resets
  base.projectedAtReset = Math.min(currentUtilization + rate * resetsInHours, 100)

  // How many hours until 100% at current rate
  const remaining = 100 - currentUtilization
  if (rate > 0) {
    const exhaustsInHours = remaining / rate
    base.exhaustsInHours = exhaustsInHours
    base.willExhaust = exhaustsInHours < resetsInHours

    if (base.willExhaust && exhaustsInHours < 1) {
      base.status = 'critical'
    } else if (base.willExhaust) {
      base.status = 'warning'
    }
  }

  // Safe rate = how fast we could consume to exactly hit 100% at reset
  if (resetsInHours > 0) {
    base.safeRatePerHour = remaining / resetsInHours
  }

  return base
}
