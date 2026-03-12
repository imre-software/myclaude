export interface RemoteModeSettings {
  enabled: boolean
  hooks: {
    stop: boolean
    permissionRequest: boolean
    notification: boolean
  }
  channels: {
    whatsapp: boolean
    telegram: boolean
  }
  timeoutMinutes: number
}

export interface RemoteHookPayload {
  session_id: string
  transcript_path: string
  cwd: string
  hook_event_name: string
  tool_name?: string
  tool_input?: Record<string, unknown>
}

export interface RemoteLogEntry {
  id: number
  sessionId: string
  hookEvent: string
  project: string
  summary: string
  userReply: string | null
  channel: string
  createdAt: string
  repliedAt: string | null
  status: 'pending' | 'replied' | 'timeout' | 'cancelled'
}

export const REMOTE_MODE_DEFAULTS: RemoteModeSettings = {
  enabled: false,
  hooks: {
    stop: true,
    permissionRequest: true,
    notification: true,
  },
  channels: {
    whatsapp: false,
    telegram: false,
  },
  timeoutMinutes: 60,
}
