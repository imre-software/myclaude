<script setup lang="ts">
import type { McpServer } from '~~/app/types/settings'
import type { McpDiscoveryResult } from '~~/server/utils/mcpDiscover'
import type { McpServerConfig, McpConfigField } from '~~/server/utils/claudeGenerate'

const { t } = useI18n()

const props = defineProps<{
  servers: McpServer[]
}>()

const store = useSettingsData()
const { addMcpServer, removeMcpServer, updateConfig } = store

const isAdding = ref(false)
const isTesting = ref(false)
const isSaving = ref(false)
const allowAll = ref(true)
const setupStep = ref<'config' | 'fields' | 'ready'>('config')
const toolCount = ref(0)
const setupError = ref('')

// AI-discovered config fields and user values
const configFields = ref<McpConfigField[]>([])
const configNotes = ref('')
const fieldValues = ref<Record<string, string>>({})

const newServer = ref({
  name: '',
  type: 'stdio' as McpServer['type'],
  package: '',
  url: '',
})

const typeOptions = [
  { label: 'NPM Package (stdio)', value: 'stdio' },
  { label: 'HTTP', value: 'http' },
  { label: 'SSE', value: 'sse' },
]

const isHttpType = computed(() => newServer.value.type !== 'stdio')

const canSetup = computed(() => {
  if (!newServer.value.name.trim()) return false
  if (newServer.value.type === 'stdio') return !!newServer.value.package.trim()
  return !!newServer.value.url.trim()
})

const hasRequiredFieldsEmpty = computed(() => {
  return configFields.value
    .filter(f => f.required)
    .some(f => !fieldValues.value[f.key]?.trim())
})

function buildServerConfig(): Omit<McpServer, 'scope' | 'enabled' | 'tokens'> {
  const server: Omit<McpServer, 'scope' | 'enabled' | 'tokens'> = {
    name: newServer.value.name.trim(),
    type: newServer.value.type,
  }

  if (newServer.value.type === 'stdio') {
    server.command = 'npx'
    server.args = ['-y', newServer.value.package.trim()]
  } else {
    server.url = newServer.value.url.trim()
  }

  // Apply config field values to the right targets
  const env: Record<string, string> = {}
  const headers: Record<string, string> = {}
  const extraArgs: string[] = []

  for (const field of configFields.value) {
    const value = fieldValues.value[field.key]?.trim()
    if (!value) continue

    const fullValue = field.valuePrefix ? `${field.valuePrefix}${value}` : value

    if (field.target === 'env') {
      env[field.key] = fullValue
    } else if (field.target === 'header') {
      headers[field.key] = fullValue
    } else if (field.target === 'arg') {
      extraArgs.push(fullValue)
    }
  }

  if (Object.keys(env).length) server.env = env
  if (Object.keys(headers).length) server.headers = headers
  if (extraArgs.length && server.args) server.args = [...server.args, ...extraArgs]

  return server
}

async function handleSetup() {
  if (!canSetup.value) return
  isTesting.value = true
  setupError.value = ''

  try {
    const server = buildServerConfig()
    const needsConfigDiscovery = configFields.value.length === 0

    const [result, discoveredConfig] = await Promise.all([
      $fetch<McpDiscoveryResult>('/api/settings/mcp-test', {
        method: 'POST',
        body: server,
      }),
      needsConfigDiscovery
        ? $fetch<McpServerConfig>('/api/settings/mcp-auth', {
            method: 'POST',
            body: {
              name: server.name,
              url: isHttpType.value ? server.url : newServer.value.package.trim(),
              type: server.type,
            },
          }).catch(() => null)
        : Promise.resolve(null),
    ])

    // Store discovered config fields
    if (discoveredConfig?.fields?.length) {
      configFields.value = discoveredConfig.fields
      configNotes.value = discoveredConfig.notes ?? ''
      // Initialize field values
      for (const field of discoveredConfig.fields) {
        if (!(field.key in fieldValues.value)) {
          fieldValues.value[field.key] = ''
        }
      }
    }

    const hasConfigFields = configFields.value.length > 0
    const hasRequiredUnfilled = configFields.value.some(f => f.required && !fieldValues.value[f.key]?.trim())

    if (hasRequiredUnfilled) {
      // Config fields discovered but not filled - show them regardless of connection result
      toolCount.value = result.tools?.length ?? 0
      setupStep.value = 'fields'
      setupError.value = ''
    } else if (result.error) {
      if (hasConfigFields) {
        // Connection failed and we have config fields - likely failed because config is missing
        setupStep.value = 'fields'
        setupError.value = ''
      } else {
        setupError.value = result.error.message
      }
    } else {
      toolCount.value = result.tools.length
      setupStep.value = 'ready'
    }
  } catch (err) {
    setupError.value = err instanceof Error ? err.message : 'Setup failed'
  } finally {
    isTesting.value = false
  }
}

async function handleSave() {
  isSaving.value = true

  try {
    const server = buildServerConfig()
    await addMcpServer(server)

    if (allowAll.value) {
      const current = store.config?.permissions.allow ?? []
      const rule = `mcp__${server.name}__*`
      if (!current.includes(rule)) {
        await updateConfig('permissions', { allow: [...current, rule] })
      }
    }

    resetForm()
  } finally {
    isSaving.value = false
  }
}

async function handleRemove(name: string) {
  await removeMcpServer(name)

  const prefix = `mcp__${name}__`
  const perms = store.config?.permissions
  if (perms) {
    const allow = perms.allow.filter(r => !r.startsWith(prefix))
    const ask = perms.ask.filter(r => !r.startsWith(prefix))
    const deny = perms.deny.filter(r => !r.startsWith(prefix))
    if (allow.length !== perms.allow.length || ask.length !== perms.ask.length || deny.length !== perms.deny.length) {
      await updateConfig('permissions', { allow, ask, deny })
    }
  }
}

function resetForm() {
  isAdding.value = false
  setupStep.value = 'config'
  toolCount.value = 0
  setupError.value = ''
  configFields.value = []
  configNotes.value = ''
  fieldValues.value = {}
  allowAll.value = true
  newServer.value = { name: '', type: 'stdio', package: '', url: '' }
}

function formatServerDetail(server: McpServer): string {
  if (server.type !== 'stdio') return server.url ?? ''
  const args = server.args ?? []
  const pkg = args.find(a => !a.startsWith('-'))
  return pkg ?? [server.command, ...args].filter(Boolean).join(' ')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-base font-medium">{{ t('settings.mcpServers') }}</h3>
        <p class="text-sm text-muted">{{ t('settings.mcpServersDesc') }}</p>
      </div>
      <UButton
        :label="t('settings.addServer')"
        icon="i-lucide-plus"
        size="sm"
        variant="outline"
        @click="isAdding = !isAdding"
      />
    </div>

    <UCard v-if="isAdding">
      <div class="flex flex-col gap-3">
        <!-- Server basics -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField :label="t('settings.serverName')">
            <UInput
              v-model="newServer.name"
              placeholder="my-server"
              class="w-full"
              :disabled="setupStep === 'ready'"
            />
          </UFormField>
          <UFormField :label="t('settings.serverType')">
            <USelect
              v-model="newServer.type"
              :items="typeOptions"
              class="w-full"
              :disabled="setupStep === 'ready'"
            />
          </UFormField>
        </div>

        <UFormField v-if="!isHttpType" label="NPM Package">
          <UInput
            v-model="newServer.package"
            placeholder="@modelcontextprotocol/server-example"
            class="w-full"
            :disabled="setupStep === 'ready'"
          />
        </UFormField>

        <UFormField v-else :label="t('settings.serverUrl')">
          <UInput
            v-model="newServer.url"
            placeholder="https://..."
            class="w-full"
            :disabled="setupStep === 'ready'"
          />
        </UFormField>

        <!-- AI-discovered config fields -->
        <div v-if="configFields.length > 0 && setupStep !== 'config'" class="flex flex-col gap-3">
          <div v-if="configNotes" class="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-sm text-info">
            <UIcon name="i-lucide-info" class="size-4 shrink-0 mt-0.5" />
            <span>{{ configNotes }}</span>
          </div>

          <div v-if="toolCount > 0 && setupStep === 'fields'" class="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            <UIcon name="i-lucide-shield-alert" class="size-4 shrink-0" />
            {{ t('settings.mcpNeedsAuth', { count: toolCount }) }}
          </div>

          <UFormField
            v-for="field in configFields"
            :key="field.key"
            :label="`${field.label}${field.required ? ' *' : ''}`"
            :hint="field.description"
          >
            <UInput
              v-model="fieldValues[field.key]"
              :type="field.sensitive ? 'password' : 'text'"
              :placeholder="field.placeholder"
              class="w-full"
              :disabled="setupStep === 'ready'"
            />
          </UFormField>
        </div>

        <!-- Error message -->
        <div v-if="setupError" class="flex items-center gap-2 rounded-lg bg-error/10 p-3 text-sm text-error">
          <UIcon name="i-lucide-alert-circle" class="size-4 shrink-0" />
          {{ setupError }}
        </div>

        <!-- Success state -->
        <div v-if="setupStep === 'ready'" class="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
          <UIcon name="i-lucide-check-circle" class="size-4 shrink-0" />
          {{ t('settings.mcpConnected', { count: toolCount }) }}
        </div>

        <!-- Allow all checkbox -->
        <UCheckbox
          v-if="setupStep === 'ready'"
          v-model="allowAll"
          :label="t('settings.allowAllMcpTools')"
          class="cursor-pointer"
        />

        <!-- Action buttons -->
        <div class="flex items-center justify-between">
          <button
            v-if="setupStep === 'fields'"
            class="text-sm text-muted underline cursor-pointer"
            @click="handleSave"
          >
            {{ t('settings.skipSetup') }}
          </button>
          <span v-else />

          <div class="flex gap-2">
            <UButton :label="t('settings.cancel')" variant="ghost" size="sm" @click="resetForm" />
            <UButton
              v-if="setupStep !== 'ready'"
              :label="t('settings.setup')"
              size="sm"
              :loading="isTesting"
              :disabled="!canSetup"
              icon="i-lucide-plug"
              class="cursor-pointer"
              @click="handleSetup"
            />
            <UButton
              v-else
              :label="t('settings.save')"
              size="sm"
              :loading="isSaving"
              icon="i-lucide-check"
              class="cursor-pointer"
              @click="handleSave"
            />
          </div>
        </div>
      </div>
    </UCard>

    <div v-if="!servers.length && !isAdding" class="flex flex-col items-center gap-2 py-8 text-muted">
      <UIcon name="i-lucide-unplug" class="size-8" />
      <p class="text-sm">{{ t('settings.noServers') }}</p>
    </div>

    <div v-else class="flex flex-col gap-2">
      <UCard v-for="server in servers" :key="server.name">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <UIcon name="i-lucide-plug" class="size-4 text-primary" />
            </div>
            <div class="min-w-0">
              <p class="text-base font-medium truncate">{{ server.name }}</p>
              <p class="text-sm text-muted truncate">{{ formatServerDetail(server) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UBadge :label="server.type" variant="subtle" size="sm" />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              class="cursor-pointer"
              @click="handleRemove(server.name)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
