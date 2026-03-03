<script setup lang="ts">
import type { PermissionRules, PermissionMode, McpServer } from '~~/app/types/settings'
import type { TabsItem } from '@nuxt/ui'

const { t } = useI18n()

const props = defineProps<{
  permissions: PermissionRules
  mcpServers: McpServer[]
}>()

const { updateConfig } = useSettingsData()

// Mode selector
const modeOptions = [
  { label: 'Default', value: 'default', description: t('settings.modeDefault') },
  { label: 'Accept Edits', value: 'acceptEdits', description: t('settings.modeAcceptEdits') },
  { label: 'Plan', value: 'plan', description: t('settings.modePlan') },
  { label: "Don't Ask", value: 'dontAsk', description: t('settings.modeDontAsk') },
  { label: 'Bypass Permissions', value: 'bypassPermissions', description: t('settings.modeBypassPermissions') },
]

async function handleModeChange(value: string) {
  await updateConfig('permissions', { defaultMode: value as PermissionMode })
}

// Rules tabs
const activeRulesTab = ref('allow')

const rulesTabItems = computed<TabsItem[]>(() => [
  {
    label: `${t('settings.allowRules')} (${props.permissions.allow.length})`,
    value: 'allow',
    icon: 'i-lucide-check-circle',
    slot: 'allow',
    ui: { leadingIcon: 'text-success' },
  },
  {
    label: `${t('settings.askRules')} (${props.permissions.ask.length})`,
    value: 'ask',
    icon: 'i-lucide-help-circle',
    slot: 'ask',
    ui: { leadingIcon: 'text-warning' },
  },
  {
    label: `${t('settings.denyRules')} (${props.permissions.deny.length})`,
    value: 'deny',
    icon: 'i-lucide-x-circle',
    slot: 'deny',
    ui: { leadingIcon: 'text-error' },
  },
])

// Tool picker - built-in tools grouped, then MCP servers from config
const commonTools = ['Bash', 'Read', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'Agent', 'Grep', 'Glob']
const otherTools = [
  'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode', 'EnterWorktree',
  'NotebookEdit', 'Skill', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList',
]

const MCP_PREFIX = 'mcp__'

const toolItems = computed(() => {
  const groups = [
    commonTools.map(tool => ({ label: tool, value: tool })),
    otherTools.map(tool => ({ label: tool, value: tool })),
  ]
  if (props.mcpServers.length) {
    groups.push(
      props.mcpServers.map(s => ({
        label: `MCP: ${s.name}`,
        value: `${MCP_PREFIX}${s.name}`,
      })),
    )
  }
  return groups
})

// Specifier options for built-in tools
const specifierPlaceholders: Record<string, string> = {
  Bash: 'npm run *, git *, etc.',
  Read: './.env, /src/**/*.ts, etc.',
  Edit: './.env, /src/**/*.ts, etc.',
  Write: './.env, /src/**/*.ts, etc.',
  WebFetch: 'domain:example.com',
  Agent: 'Explore, Plan, etc.',
  Grep: './.env, /src/**/*.ts, etc.',
  Glob: './.env, /src/**/*.ts, etc.',
}

const toolsWithSpecifier = new Set(Object.keys(specifierPlaceholders))

// Add rule form state
const isAdding = ref(false)
const selectedTool = ref('Bash')
const specifier = ref('')
const selectedMcpTool = ref('*')

const isMcpServer = computed(() => selectedTool.value.startsWith(MCP_PREFIX))
const mcpServerName = computed(() => isMcpServer.value ? selectedTool.value.slice(MCP_PREFIX.length) : '')
const showSpecifier = computed(() => !isMcpServer.value && toolsWithSpecifier.has(selectedTool.value))

// MCP tool discovery - fetch tools when an MCP server is selected
const mcpToolsCache = ref<Record<string, Array<{ name: string, description?: string }>>>({})
const isLoadingMcpTools = ref(false)

watch(mcpServerName, async (name) => {
  if (!name) return
  selectedMcpTool.value = '*'
  if (mcpToolsCache.value[name]) return

  isLoadingMcpTools.value = true
  try {
    const tools = await $fetch<Array<{ name: string, description?: string }>>('/api/settings/mcp-tools', {
      params: { server: name },
    })
    mcpToolsCache.value[name] = tools
  } catch {
    mcpToolsCache.value[name] = []
  } finally {
    isLoadingMcpTools.value = false
  }
})

const mcpToolItems = computed(() => {
  const allOption = { label: t('settings.allToolsWildcard'), value: '*' }
  const tools = mcpToolsCache.value[mcpServerName.value]
  if (!tools?.length) return [[allOption]]
  return [
    [allOption],
    tools.map(tool => ({ label: tool.name, value: tool.name })),
  ]
})

// Rule preview
const rulePreview = computed(() => {
  if (isMcpServer.value) {
    return `${selectedTool.value}__${selectedMcpTool.value || '*'}`
  }
  if (specifier.value) return `${selectedTool.value}(${specifier.value})`
  return selectedTool.value
})

const canAdd = computed(() => {
  if (isMcpServer.value) return selectedMcpTool.value.length > 0
  return true
})

async function handleAddRule() {
  if (!canAdd.value) return

  let rule: string
  if (isMcpServer.value) {
    rule = `${selectedTool.value}__${selectedMcpTool.value}`
  } else {
    rule = specifier.value ? `${selectedTool.value}(${specifier.value})` : selectedTool.value
  }

  const category = activeRulesTab.value as 'allow' | 'ask' | 'deny'
  const current = [...props.permissions[category], rule]
  await updateConfig('permissions', { [category]: current })
  resetForm()
}

function resetForm() {
  isAdding.value = false
  selectedTool.value = 'Bash'
  specifier.value = ''
  selectedMcpTool.value = '*'
}

async function handleRemoveRule(category: 'allow' | 'ask' | 'deny', index: number) {
  const current = [...props.permissions[category]]
  current.splice(index, 1)
  await updateConfig('permissions', { [category]: current })
}

function parseRule(rule: string): { tool: string, specifier?: string } {
  const match = rule.match(/^([^(]+)\((.+)\)$/)
  if (match) return { tool: match[1], specifier: match[2] }
  return { tool: rule }
}

// Additional Directories
const isAddingDir = ref(false)
const newDirPath = ref('')

async function handleAddDirectory() {
  const path = newDirPath.value.trim()
  if (!path) return
  const current = [...(props.permissions.additionalDirectories || []), path]
  await updateConfig('permissions', { additionalDirectories: current })
  isAddingDir.value = false
  newDirPath.value = ''
}

async function handleRemoveDirectory(index: number) {
  const current = [...(props.permissions.additionalDirectories || [])]
  current.splice(index, 1)
  await updateConfig('permissions', { additionalDirectories: current })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h3 class="text-base font-medium">{{ t('settings.permissions') }}</h3>
      <p class="text-sm text-muted">{{ t('settings.permissionsDesc') }}</p>
    </div>

    <!-- Mode Selector -->
    <UFormField :label="t('settings.permissionMode')">
      <URadioGroup
        :model-value="permissions.defaultMode"
        :items="modeOptions"
        variant="card"
        class="mt-1"
        @update:model-value="handleModeChange"
      />
    </UFormField>

    <!-- Rules Section -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h4 class="text-base font-medium">{{ t('settings.rules') }}</h4>
        <UButton
          :label="t('settings.addRule')"
          icon="i-lucide-plus"
          size="sm"
          variant="outline"
          @click="isAdding = !isAdding"
        />
      </div>

      <!-- Add Rule Form -->
      <UCard v-if="isAdding">
        <div class="flex flex-col gap-3">
          <!-- Row 1: Tool + Specifier/MCP Tool side by side -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UFormField :label="t('settings.tool')">
              <USelectMenu
                v-model="selectedTool"
                :items="toolItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <!-- MCP: tool picker from discovered tools -->
            <UFormField v-if="isMcpServer" :label="t('settings.mcpToolName')">
              <USelectMenu
                v-model="selectedMcpTool"
                :items="mcpToolItems"
                value-key="value"
                :loading="isLoadingMcpTools"
                class="w-full"
              />
            </UFormField>

            <!-- Built-in: specifier input -->
            <UFormField v-else-if="showSpecifier" :label="t('settings.specifier')">
              <UInput
                v-model="specifier"
                :placeholder="specifierPlaceholders[selectedTool] || ''"
                class="w-full font-mono"
              />
            </UFormField>
          </div>

          <!-- Preview + Actions -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-sm text-muted">{{ t('settings.rulePreview') }}:</span>
              <code class="text-sm font-mono bg-elevated px-2 py-0.5 rounded truncate">{{ rulePreview }}</code>
            </div>
            <div class="flex gap-2 shrink-0">
              <UButton :label="t('settings.cancel')" variant="ghost" size="sm" @click="resetForm" />
              <UButton :label="t('settings.addRule')" size="sm" :disabled="!canAdd" @click="handleAddRule" />
            </div>
          </div>
        </div>
      </UCard>

      <!-- Category Tabs -->
      <UTabs
        v-model="activeRulesTab"
        :items="rulesTabItems"
        variant="link"
        color="neutral"
        :unmount-on-hide="false"
      >
        <template v-for="cat in (['allow', 'ask', 'deny'] as const)" :key="cat" #[cat]>
          <div class="pt-3">
            <UCard v-if="permissions[cat].length" :ui="{ body: 'p-0 sm:p-0' }">
              <div class="divide-y divide-default">
                <div
                  v-for="(rule, index) in permissions[cat]"
                  :key="index"
                  class="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-base font-medium">{{ parseRule(rule).tool }}</span>
                    <span v-if="parseRule(rule).specifier" class="text-sm font-mono text-muted truncate">
                      {{ parseRule(rule).specifier }}
                    </span>
                  </div>
                  <UButton
                    icon="i-lucide-x"
                    variant="ghost"
                    color="error"
                    size="xs"
                    @click="handleRemoveRule(cat, index)"
                  />
                </div>
              </div>
            </UCard>

            <p v-else class="text-sm text-muted py-4">{{ t('settings.noRules') }}</p>
          </div>
        </template>
      </UTabs>
    </div>

    <!-- Additional Directories -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-base font-medium">{{ t('settings.additionalDirectories') }}</h4>
          <p class="text-sm text-muted">{{ t('settings.additionalDirectoriesDesc') }}</p>
        </div>
        <UButton
          :label="t('settings.addDirectory')"
          icon="i-lucide-plus"
          size="sm"
          variant="outline"
          @click="isAddingDir = !isAddingDir"
        />
      </div>

      <UCard v-if="isAddingDir">
        <div class="flex flex-col gap-3">
          <UFormField :label="t('settings.directoryPath')">
            <UInput
              v-model="newDirPath"
              placeholder="/path/to/directory"
              class="w-full font-mono"
              @keydown.enter="handleAddDirectory"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton :label="t('settings.cancel')" variant="ghost" size="sm" @click="isAddingDir = false; newDirPath = ''" />
            <UButton :label="t('settings.save')" size="sm" :disabled="!newDirPath.trim()" @click="handleAddDirectory" />
          </div>
        </div>
      </UCard>

      <UCard v-if="(permissions.additionalDirectories || []).length" :ui="{ body: 'p-0 sm:p-0' }">
        <div class="divide-y divide-default">
          <div
            v-for="(dir, index) in permissions.additionalDirectories"
            :key="index"
            class="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span class="text-base font-mono truncate">{{ dir }}</span>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="error"
              size="xs"
              @click="handleRemoveDirectory(index)"
            />
          </div>
        </div>
      </UCard>

      <div v-else-if="!isAddingDir" class="flex flex-col items-center gap-2 py-6 text-muted">
        <UIcon name="i-lucide-folder-plus" class="size-8" />
        <p class="text-sm">{{ t('settings.noDirectories') }}</p>
      </div>
    </div>
  </div>
</template>
