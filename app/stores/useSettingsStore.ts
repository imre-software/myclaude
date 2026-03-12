import type {
  SettingsConfigResponse,
  McpServer,
  MemoryFile,
  AgentDefinition,
  SkillDefinition,
  HookEntry,
  GenerateResponse,
} from '~/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<SettingsConfigResponse | null>(null)
  const mcpServers = ref<McpServer[]>([])
  const memoryFiles = ref<MemoryFile[]>([])
  const agents = ref<AgentDefinition[]>([])
  const skills = ref<SkillDefinition[]>([])
  const hooks = ref<HookEntry[]>([])

  async function loadAll() {
    const [configRes, mcpRes, memoryRes, agentsRes, skillsRes, hooksRes] = await Promise.all([
      $fetch<SettingsConfigResponse>('/api/settings/config'),
      $fetch<McpServer[]>('/api/settings/mcp-servers'),
      $fetch<MemoryFile[]>('/api/settings/memory'),
      $fetch<AgentDefinition[]>('/api/settings/agents'),
      $fetch<SkillDefinition[]>('/api/settings/skills'),
      $fetch<HookEntry[]>('/api/settings/hooks'),
    ])
    config.value = configRes
    mcpServers.value = mcpRes
    memoryFiles.value = memoryRes
    agents.value = agentsRes
    skills.value = skillsRes
    hooks.value = hooksRes
  }

  async function updateConfig(section: string, data: Record<string, unknown>) {
    await $fetch('/api/settings/config', { method: 'PUT', body: { [section]: data } })
    config.value = await $fetch<SettingsConfigResponse>('/api/settings/config')
  }

  async function addMcpServer(server: Omit<McpServer, 'scope' | 'enabled' | 'tokens'>) {
    await $fetch('/api/settings/mcp-servers', { method: 'POST', body: server })
    mcpServers.value = await $fetch<McpServer[]>('/api/settings/mcp-servers')
  }

  async function removeMcpServer(name: string) {
    await $fetch('/api/settings/mcp-servers', { method: 'DELETE', body: { name } })
    mcpServers.value = await $fetch<McpServer[]>('/api/settings/mcp-servers')
  }

  async function updateMemory(path: string, content: string) {
    await $fetch('/api/settings/memory', { method: 'PUT', body: { path, content } })
    memoryFiles.value = await $fetch<MemoryFile[]>('/api/settings/memory')
  }

  async function saveAgent(scope: 'user' | 'project', filename: string, content: string) {
    await $fetch('/api/settings/agents', { method: 'POST', body: { scope, filename, content } })
    agents.value = await $fetch<AgentDefinition[]>('/api/settings/agents')
  }

  async function deleteAgent(scope: 'user' | 'project', filename: string) {
    await $fetch('/api/settings/agents', { method: 'DELETE', body: { scope, filename } })
    agents.value = await $fetch<AgentDefinition[]>('/api/settings/agents')
  }

  async function saveSkill(scope: 'user' | 'project', dirname: string, content: string) {
    await $fetch('/api/settings/skills', { method: 'POST', body: { scope, dirname, content } })
    skills.value = await $fetch<SkillDefinition[]>('/api/settings/skills')
  }

  async function deleteSkill(scope: 'user' | 'project', dirname: string) {
    await $fetch('/api/settings/skills', { method: 'DELETE', body: { scope, dirname } })
    skills.value = await $fetch<SkillDefinition[]>('/api/settings/skills')
  }

  async function loadHooks() {
    hooks.value = await $fetch<HookEntry[]>('/api/settings/hooks')
  }

  async function saveAllHooks(entries: HookEntry[]) {
    await $fetch('/api/settings/hooks', { method: 'PUT', body: { entries } })
    await loadHooks()
  }

  async function generate(type: 'skill' | 'agent' | 'hook', prompt: string): Promise<GenerateResponse | null> {
    const { jobId } = await $fetch<{ jobId: string }>('/api/settings/generate', {
      method: 'POST',
      body: { type, prompt },
    })

    return new Promise((resolve, reject) => {
      const es = new EventSource(`/api/settings/generate/stream?jobId=${jobId}`)
      es.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.status === 'done') {
          es.close()
          resolve(data.result as GenerateResponse | null)
        } else if (data.status === 'error') {
          es.close()
          reject(new Error(data.error))
        }
      }
      es.onerror = () => {
        es.close()
        reject(new Error('Connection to generation stream lost'))
      }
    })
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
    loadAll,
    updateConfig,
    addMcpServer,
    removeMcpServer,
    updateMemory,
    saveAgent,
    deleteAgent,
    saveSkill,
    deleteSkill,
    loadHooks,
    saveAllHooks,
    generate,
    aiUpdate,
  }
})
