import type {
  SettingsConfigResponse,
  McpServer,
  MemoryFile,
  AgentDefinition,
  SkillDefinition,
  HookEntry,
  GenerateResponse,
} from '~~/app/types/settings'

export function useSettingsData() {
  const { data: config, refresh: refreshConfig, status: configStatus } = useFetch<SettingsConfigResponse>('/api/settings/config')
  const { data: mcpServers, refresh: refreshMcp } = useFetch<McpServer[]>('/api/settings/mcp-servers')
  const { data: memoryFiles, refresh: refreshMemory } = useFetch<MemoryFile[]>('/api/settings/memory')
  const { data: agents, refresh: refreshAgents } = useFetch<AgentDefinition[]>('/api/settings/agents')
  const { data: skills, refresh: refreshSkills } = useFetch<SkillDefinition[]>('/api/settings/skills')
  const { data: hooks, refresh: refreshHooks } = useFetch<HookEntry[]>('/api/settings/hooks')

  const isLoading = computed(() => configStatus.value === 'pending')

  // Config updates
  async function updateConfig(section: string, data: Record<string, unknown>) {
    await $fetch('/api/settings/config', { method: 'PUT', body: { [section]: data } })
    await refreshConfig()
  }

  // MCP Servers
  async function addMcpServer(server: Omit<McpServer, 'scope' | 'enabled' | 'tokens'>) {
    await $fetch('/api/settings/mcp-servers', { method: 'POST', body: server })
    await refreshMcp()
  }

  async function removeMcpServer(name: string) {
    await $fetch('/api/settings/mcp-servers', { method: 'DELETE', body: { name } })
    await refreshMcp()
  }

  // Memory
  async function updateMemory(path: string, content: string) {
    await $fetch('/api/settings/memory', { method: 'PUT', body: { path, content } })
    await refreshMemory()
  }

  // Agents
  async function saveAgent(scope: 'user' | 'project', filename: string, content: string) {
    await $fetch('/api/settings/agents', { method: 'POST', body: { scope, filename, content } })
    await refreshAgents()
  }

  async function deleteAgent(scope: 'user' | 'project', filename: string) {
    await $fetch('/api/settings/agents', { method: 'DELETE', body: { scope, filename } })
    await refreshAgents()
  }

  // Skills
  async function saveSkill(scope: 'user' | 'project', dirname: string, content: string) {
    await $fetch('/api/settings/skills', { method: 'POST', body: { scope, dirname, content } })
    await refreshSkills()
  }

  async function deleteSkill(scope: 'user' | 'project', dirname: string) {
    await $fetch('/api/settings/skills', { method: 'DELETE', body: { scope, dirname } })
    await refreshSkills()
  }

  // Hooks
  async function saveAllHooks(entries: HookEntry[]) {
    await $fetch('/api/settings/hooks', { method: 'PUT', body: { entries } })
    await refreshHooks()
  }

  // AI Generate
  async function generate(type: 'skill' | 'agent' | 'hook', prompt: string): Promise<GenerateResponse> {
    return $fetch<GenerateResponse>('/api/settings/generate', { method: 'POST', body: { type, prompt } })
  }

  async function aiUpdate(content: string, prompt: string): Promise<string> {
    const res = await $fetch<{ content: string }>('/api/settings/ai-update', { method: 'POST', body: { content, prompt } })
    return res.content
  }

  return {
    config,
    mcpServers,
    memoryFiles,
    agents,
    skills,
    hooks,
    isLoading,
    updateConfig,
    addMcpServer,
    removeMcpServer,
    updateMemory,
    saveAgent,
    deleteAgent,
    saveSkill,
    deleteSkill,
    saveAllHooks,
    generate,
    aiUpdate,
    refreshConfig,
    refreshMcp,
    refreshMemory,
    refreshAgents,
    refreshSkills,
    refreshHooks,
  }
}
