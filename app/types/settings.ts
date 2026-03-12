// MCP Servers
export interface McpServer {
  name: string
  type: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  scope: 'user' | 'project'
  enabled: boolean
  tokens?: number
}

// Model Configuration
export interface ModelConfig {
  model: string
  availableModels: string[]
  effortLevel: 'low' | 'medium' | 'high' | 'max'
  alwaysThinkingEnabled: boolean
  fastModePerSessionOptIn: boolean
}

// Permissions
export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'

export interface PermissionRules {
  allow: string[]
  ask: string[]
  deny: string[]
  additionalDirectories: string[]
  defaultMode: PermissionMode
}

// Memory Files (CLAUDE.md)
export interface MemoryFile {
  path: string
  scope: 'user' | 'project' | 'project-local'
  label: string
  content: string
  tokens?: number
  writable: boolean
}

// Agents
export interface AgentDefinition {
  name: string
  filename: string
  scope: 'user' | 'project'
  description: string
  model?: string
  tools?: string
  tokens?: number
  content: string
}

// Skills
export interface SkillDefinition {
  name: string
  dirname: string
  scope: 'user' | 'project'
  description: string
  userInvocable: boolean
  tokens?: number
  content: string
}

// Hooks
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'PermissionRequest'
  | 'Notification'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'

export interface HookHandler {
  type: 'command' | 'http'
  command?: string
  url?: string
  timeout?: number
  async?: boolean
  statusMessage?: string
}

export interface HookEntry {
  event: HookEvent
  matcher?: string
  handlers: HookHandler[]
}

// Appearance
export interface AppearanceConfig {
  theme: 'dark' | 'light' | 'auto'
  language: string
  showTurnDuration: boolean
  spinnerTipsEnabled: boolean
  terminalProgressBarEnabled: boolean
}

// Account (read-only)
export interface AccountInfo {
  subscriptionType: 'max' | 'api'
  email?: string
  model: string
}

// API Responses
export interface SettingsConfigResponse {
  model: ModelConfig
  permissions: PermissionRules
  appearance: AppearanceConfig
  account: AccountInfo
  attribution: {
    commit: string
    pr: string
  }
  cleanupPeriodDays: number
}

export interface GenerateRequest {
  type: 'skill' | 'agent' | 'hook'
  prompt: string
}

export interface GenerateResponse {
  content: string
  name: string
  filename: string
}
