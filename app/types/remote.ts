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

export type ChatChannel = 'whatsapp' | 'telegram'

export type ChatFlowState = 'idle' | 'selecting' | 'chatting'

export interface ActiveClaudeSession {
  pid: number
  cwd: string
  project: string
  lastMessage?: string
}

export interface ChatFlowContext {
  state: ChatFlowState
  sessions: ActiveClaudeSession[]
  selectedSession: ActiveClaudeSession | null
  lastActivity: number
}

export type ChatAction =
  | { type: 'session-list', sessions: ActiveClaudeSession[] }
  | { type: 'session-selected', session: ActiveClaudeSession }
  | { type: 'no-sessions' }
  | { type: 'chatting-hint' }
  | { type: 'reset' }
  | { type: 'invalid-selection', max: number }

export interface ProjectRoutingRule {
  id: number
  projectName: string
  telegramChatId: string | null
  telegramChatTitle: string | null
  whatsappJid: string | null
  whatsappName: string | null
  whatsappPictureUrl: string | null
  enabled: boolean
  createdAt: string
}

export interface DiscoveredTelegramGroup {
  id: string
  title: string
  type: string
}

export interface DiscoveredWhatsAppGroup {
  jid: string
  name: string
  size: number
  pictureUrl: string | null
  desc: string | null
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
