<script setup lang="ts">
import type { McpServer } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  servers: McpServer[]
}>()

const { addMcpServer, removeMcpServer } = useSettingsData()

const isAdding = ref(false)
const isSaving = ref(false)
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

const canSave = computed(() => {
  if (!newServer.value.name.trim()) return false
  if (newServer.value.type === 'stdio') return !!newServer.value.package.trim()
  return !!newServer.value.url.trim()
})

async function handleAdd() {
  if (!canSave.value) return
  isSaving.value = true

  try {
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

    await addMcpServer(server)
    isAdding.value = false
    newServer.value = { name: '', type: 'stdio', package: '', url: '' }
  } finally {
    isSaving.value = false
  }
}

async function handleRemove(name: string) {
  await removeMcpServer(name)
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
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField :label="t('settings.serverName')">
            <UInput v-model="newServer.name" placeholder="my-server" class="w-full" />
          </UFormField>
          <UFormField :label="t('settings.serverType')">
            <USelect
              v-model="newServer.type"
              :items="typeOptions"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField v-if="newServer.type === 'stdio'" label="NPM Package">
          <UInput
            v-model="newServer.package"
            placeholder="@modelcontextprotocol/server-example"
            class="w-full"
          />
        </UFormField>

        <UFormField v-else :label="t('settings.serverUrl')">
          <UInput v-model="newServer.url" placeholder="https://..." class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton :label="t('settings.cancel')" variant="ghost" size="sm" @click="isAdding = false" />
          <UButton :label="t('settings.save')" size="sm" :loading="isSaving" :disabled="!canSave" @click="handleAdd" />
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
              @click="handleRemove(server.name)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
