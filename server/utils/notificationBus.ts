type Listener = (event: NotificationEvent) => void

export interface NotificationEvent {
  type: string
  windowType: string
  level: number
  utilization: number
  title: string
  body: string
}

const listeners = new Set<Listener>()

export function pushNotificationEvent(event: NotificationEvent): void {
  for (const listener of listeners) {
    listener(event)
  }
}

export function onNotificationEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
