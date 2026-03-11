export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'qr-ready' | 'connected' | 'logged-out'

export interface WhatsAppStatus {
  connection: WhatsAppConnectionStatus
  phoneNumber: string
  queueStats: { pending: number, failed: number }
}

export interface WhatsAppQrEvent {
  type: 'qr'
  qr: string
}

export interface WhatsAppStatusEvent {
  type: 'status'
  connection: WhatsAppConnectionStatus
}

export interface WhatsAppConnectedEvent {
  type: 'connected'
}

export interface WhatsAppErrorEvent {
  type: 'error'
  message: string
}

export type WhatsAppEvent = WhatsAppQrEvent | WhatsAppStatusEvent | WhatsAppConnectedEvent | WhatsAppErrorEvent
