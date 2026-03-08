type Listener = (event: BusEvent) => void

export interface NotificationEvent {
  type: string
  windowType: string
  level: number
  utilization: number
  title: string
  body: string
}

export interface UsageUpdateEvent {
  type: 'usage-update'
  fiveHour: number | null
  sevenDay: number | null
  sevenDaySonnet: number | null
}

export type BusEvent = NotificationEvent | UsageUpdateEvent

const listeners = new Set<Listener>()

export function pushNotificationEvent(event: BusEvent): void {
  for (const listener of listeners) {
    listener(event)
  }
}

export function onNotificationEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
