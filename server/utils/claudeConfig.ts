import { readFile, writeFile, readdir, mkdir, unlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type {
  McpServer,
  ModelConfig,
  PermissionRules,
  PermissionMode,
  AppearanceConfig,
  MemoryFile,
  AgentDefinition,
  SkillDefinition,
  HookEntry,
  HookEvent,
  HookHandler,
  AccountInfo,
} from '~~/app/types/settings'

const HOME = process.env.HOME ?? ''
const CLAUDE_DIR = join(HOME, '.claude')
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json')
const CLAUDE_JSON_PATH = join(HOME, '.claude.json')
const AGENTS_DIR = join(CLAUDE_DIR, 'agents')
const SKILLS_DIR = join(CLAUDE_DIR, 'skills')

// ---- JSON Helpers ----

async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeJsonFile(path: string, data: Record<string, unknown>): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export async function readSettings(): Promise<Record<string, unknown>> {
  return readJsonFile(SETTINGS_PATH)
}

export async function writeSettings(data: Record<string, unknown>): Promise<void> {
  await writeJsonFile(SETTINGS_PATH, data)
}

export async function readClaudeJson(): Promise<Record<string, unknown>> {
  return readJsonFile(CLAUDE_JSON_PATH)
}

async function writeClaudeJson(data: Record<string, unknown>): Promise<void> {
  await writeJsonFile(CLAUDE_JSON_PATH, data)
}

// ---- Model Config ----

export async function getModelConfig(): Promise<ModelConfig> {
  const settings = await readSettings()
  return {
    model: (settings.model as string) ?? 'default',
    availableModels: ['default', 'sonnet', 'opus', 'haiku'],
    effortLevel: (settings.effortLevel as ModelConfig['effortLevel']) ?? 'high',
    alwaysThinkingEnabled: (settings.alwaysThinkingEnabled as boolean) ?? false,
    fastModePerSessionOptIn: (settings.fastModePerSessionOptIn as boolean) ?? false,
  }
}

export async function updateModelConfig(config: Partial<ModelConfig>): Promise<void> {
  const settings = await readSettings()
  if (config.model !== undefined) settings.model = config.model
  if (config.effortLevel !== undefined) settings.effortLevel = config.effortLevel
  if (config.alwaysThinkingEnabled !== undefined) settings.alwaysThinkingEnabled = config.alwaysThinkingEnabled
  if (config.fastModePerSessionOptIn !== undefined) settings.fastModePerSessionOptIn = config.fastModePerSessionOptIn
  await writeSettings(settings)
}

// ---- Permissions ----

export async function getPermissions(): Promise<PermissionRules> {
  const settings = await readSettings()
  const perms = (settings.permissions ?? {}) as Record<string, unknown>
  return {
    allow: (perms.allow as string[]) ?? [],
    ask: (perms.ask as string[]) ?? [],
    deny: (perms.deny as string[]) ?? [],
    additionalDirectories: (perms.additionalDirectories as string[]) ?? [],
    defaultMode: (perms.defaultMode as PermissionMode) ?? 'default',
  }
}

export async function updatePermissions(rules: Partial<PermissionRules>): Promise<void> {
  const settings = await readSettings()
  const perms = (settings.permissions ?? {}) as Record<string, unknown>
  if (rules.allow !== undefined) perms.allow = rules.allow
  if (rules.ask !== undefined) perms.ask = rules.ask
  if (rules.deny !== undefined) perms.deny = rules.deny
  if (rules.additionalDirectories !== undefined) perms.additionalDirectories = rules.additionalDirectories
  if (rules.defaultMode !== undefined) perms.defaultMode = rules.defaultMode
  settings.permissions = perms
  await writeSettings(settings)
}

// ---- Appearance ----

export async function getAppearance(): Promise<AppearanceConfig> {
  const settings = await readSettings()
  const claudeJson = await readClaudeJson()
  return {
    theme: (claudeJson.theme as AppearanceConfig['theme']) ?? 'auto',
    language: (settings.language as string) ?? '',
    showTurnDuration: (settings.showTurnDuration as boolean) ?? true,
    spinnerTipsEnabled: (settings.spinnerTipsEnabled as boolean) ?? true,
    terminalProgressBarEnabled: (settings.terminalProgressBarEnabled as boolean) ?? true,
  }
}

export async function updateAppearance(config: Partial<AppearanceConfig>): Promise<void> {
  if (config.theme !== undefined) {
    const claudeJson = await readClaudeJson()
    claudeJson.theme = config.theme
    await writeClaudeJson(claudeJson)
  }
  const settingsKeys: (keyof AppearanceConfig)[] = ['language', 'showTurnDuration', 'spinnerTipsEnabled', 'terminalProgressBarEnabled']
  const hasSettingsUpdate = settingsKeys.some(k => config[k] !== undefined)
  if (hasSettingsUpdate) {
    const settings = await readSettings()
    for (const key of settingsKeys) {
      if (config[key] !== undefined) {
        settings[key] = config[key] as string | boolean
      }
    }
    await writeSettings(settings)
  }
}

// ---- Account Info ----

export async function getAccountInfo(): Promise<AccountInfo> {
  const subType = await getSubscriptionType()
  const settings = await readSettings()
  return {
    subscriptionType: subType,
    model: (settings.model as string) ?? 'default',
  }
}

// ---- MCP Servers ----

export async function getMcpServers(): Promise<McpServer[]> {
  const claudeJson = await readClaudeJson()
  const servers: McpServer[] = []

  const mcpServers = (claudeJson.mcpServers ?? {}) as Record<string, Record<string, unknown>>
  for (const [name, config] of Object.entries(mcpServers)) {
    servers.push({
      name,
      type: (config.type as McpServer['type']) ?? 'stdio',
      command: config.command as string | undefined,
      args: config.args as string[] | undefined,
      env: config.env as Record<string, string> | undefined,
      url: config.url as string | undefined,
      headers: config.headers as Record<string, string> | undefined,
      scope: 'user',
      enabled: true,
    })
  }

  return servers
}

export async function addMcpServer(server: Omit<McpServer, 'scope' | 'enabled' | 'tokens'>): Promise<void> {
  const claudeJson = await readClaudeJson()
  const mcpServers = (claudeJson.mcpServers ?? {}) as Record<string, Record<string, unknown>>

  const config: Record<string, unknown> = { type: server.type }
  if (server.command) config.command = server.command
  if (server.args?.length) config.args = server.args
  if (server.env && Object.keys(server.env).length) config.env = server.env
  if (server.url) config.url = server.url
  if (server.headers && Object.keys(server.headers).length) config.headers = server.headers

  mcpServers[server.name] = config
  claudeJson.mcpServers = mcpServers
  await writeClaudeJson(claudeJson)
}

export async function removeMcpServer(name: string): Promise<void> {
  const claudeJson = await readClaudeJson()
  const mcpServers = (claudeJson.mcpServers ?? {}) as Record<string, Record<string, unknown>>
  delete mcpServers[name]
  claudeJson.mcpServers = mcpServers
  await writeClaudeJson(claudeJson)
}

// ---- Memory Files ----

export async function getMemoryFiles(): Promise<MemoryFile[]> {
  const files: MemoryFile[] = []

  const globalPath = join(CLAUDE_DIR, 'CLAUDE.md')
  if (existsSync(globalPath)) {
    const content = await readFile(globalPath, 'utf-8')
    files.push({ path: globalPath, scope: 'user', label: '~/.claude/CLAUDE.md', content, writable: true })
  }

  const projectPaths = [
    { path: join(process.cwd(), 'CLAUDE.md'), label: 'CLAUDE.md' },
    { path: join(process.cwd(), '.claude', 'CLAUDE.md'), label: '.claude/CLAUDE.md' },
  ]
  for (const p of projectPaths) {
    if (existsSync(p.path)) {
      const content = await readFile(p.path, 'utf-8')
      files.push({ path: p.path, scope: 'project', label: p.label, content, writable: true })
    }
  }

  const localPath = join(process.cwd(), 'CLAUDE.local.md')
  if (existsSync(localPath)) {
    const content = await readFile(localPath, 'utf-8')
    files.push({ path: localPath, scope: 'project-local', label: 'CLAUDE.local.md', content, writable: true })
  }

  return files
}

export async function updateMemoryFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf-8')
}

// ---- Agents ----

function parseMarkdownFrontmatter(content: string): { frontmatter: Record<string, string>, body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
      frontmatter[key] = value
    }
  }
  return { frontmatter, body: match[2]!.trim() }
}

export async function getAgents(): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = []

  for (const dir of [AGENTS_DIR, join(process.cwd(), '.claude', 'agents')]) {
    if (!existsSync(dir)) continue
    const scope = dir === AGENTS_DIR ? 'user' : 'project' as const
    const files = await readdir(dir)

    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const content = await readFile(join(dir, file), 'utf-8')
      const { frontmatter } = parseMarkdownFrontmatter(content)

      agents.push({
        name: frontmatter.name ?? file.replace('.md', ''),
        filename: file,
        scope,
        description: frontmatter.description ?? '',
        model: frontmatter.model,
        tools: frontmatter.tools,
        content,
      })
    }
  }

  return agents
}

export async function saveAgent(scope: 'user' | 'project', filename: string, content: string): Promise<void> {
  const dir = scope === 'user' ? AGENTS_DIR : join(process.cwd(), '.claude', 'agents')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), content, 'utf-8')
}

export async function deleteAgent(scope: 'user' | 'project', filename: string): Promise<void> {
  const dir = scope === 'user' ? AGENTS_DIR : join(process.cwd(), '.claude', 'agents')
  const filePath = join(dir, filename)
  if (existsSync(filePath)) await unlink(filePath)
}

// ---- Skills ----

export async function getSkills(): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = []

  for (const dir of [SKILLS_DIR, join(process.cwd(), '.claude', 'skills')]) {
    if (!existsSync(dir)) continue
    const scope = dir === SKILLS_DIR ? 'user' : 'project' as const
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = join(dir, entry.name, 'SKILL.md')
      if (!existsSync(skillPath)) continue

      const content = await readFile(skillPath, 'utf-8')
      const { frontmatter } = parseMarkdownFrontmatter(content)

      skills.push({
        name: frontmatter.name ?? entry.name,
        dirname: entry.name,
        scope,
        description: frontmatter.description ?? '',
        userInvocable: frontmatter['user-invocable'] !== 'false',
        content,
      })
    }
  }

  return skills
}

export async function saveSkill(scope: 'user' | 'project', dirname: string, content: string): Promise<void> {
  const baseDir = scope === 'user' ? SKILLS_DIR : join(process.cwd(), '.claude', 'skills')
  const skillDir = join(baseDir, dirname)
  if (!existsSync(skillDir)) await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8')
}

export async function deleteSkill(scope: 'user' | 'project', dirname: string): Promise<void> {
  const baseDir = scope === 'user' ? SKILLS_DIR : join(process.cwd(), '.claude', 'skills')
  const skillDir = join(baseDir, dirname)
  if (existsSync(skillDir)) await rm(skillDir, { recursive: true })
}

// ---- Hooks ----

export async function getHooks(): Promise<HookEntry[]> {
  const settings = await readSettings()
  const hooksConfig = (settings.hooks ?? {}) as Record<string, Array<Record<string, unknown>>>
  const entries: HookEntry[] = []

  for (const [event, matchers] of Object.entries(hooksConfig)) {
    for (const matcherObj of matchers) {
      const matcher = matcherObj.matcher as string | undefined
      const hooks = (matcherObj.hooks ?? []) as Array<Record<string, unknown>>

      const handlers: HookHandler[] = hooks.map(h => ({
        type: (h.type as HookHandler['type']) ?? 'command',
        command: h.command as string | undefined,
        url: h.url as string | undefined,
        timeout: h.timeout as number | undefined,
        async: h.async as boolean | undefined,
        statusMessage: h.statusMessage as string | undefined,
      }))

      entries.push({ event: event as HookEvent, matcher, handlers })
    }
  }

  return entries
}

export async function saveHooks(entries: HookEntry[]): Promise<void> {
  const settings = await readSettings()
  const hooksConfig: Record<string, Array<Record<string, unknown>>> = {}

  for (const entry of entries) {
    if (!hooksConfig[entry.event]) hooksConfig[entry.event] = []

    const matcherObj: Record<string, unknown> = {}
    if (entry.matcher) matcherObj.matcher = entry.matcher

    matcherObj.hooks = entry.handlers.map(h => {
      const obj: Record<string, unknown> = { type: h.type }
      if (h.command) obj.command = h.command
      if (h.url) obj.url = h.url
      if (h.timeout !== undefined) obj.timeout = h.timeout
      if (h.async !== undefined) obj.async = h.async
      if (h.statusMessage) obj.statusMessage = h.statusMessage
      return obj
    })

    hooksConfig[entry.event]!.push(matcherObj)
  }

  settings.hooks = hooksConfig
  await writeSettings(settings)
}

// ---- Attribution ----

export async function getAttribution(): Promise<{ commit: string, pr: string }> {
  const settings = await readSettings()
  const attr = (settings.attribution ?? {}) as Record<string, string>
  return { commit: attr.commit ?? '', pr: attr.pr ?? '' }
}

export async function updateAttribution(attr: { commit?: string, pr?: string }): Promise<void> {
  const settings = await readSettings()
  const current = (settings.attribution ?? {}) as Record<string, string>
  if (attr.commit !== undefined) current.commit = attr.commit
  if (attr.pr !== undefined) current.pr = attr.pr
  settings.attribution = current
  await writeSettings(settings)
}
