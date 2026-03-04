<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { t } = useI18n()

definePageMeta({
  layout: 'dashboard',
})

const store = useSettingsStore()

const activeTab = ref('model')

const tabItems = computed<TabsItem[]>(() => [
  { label: t('settings.model'), icon: 'i-lucide-cpu', value: 'model', slot: 'model' },
  { label: t('settings.permissions'), icon: 'i-lucide-shield', value: 'permissions', slot: 'permissions' },
  { label: t('settings.mcpServers'), icon: 'i-lucide-plug', value: 'mcp', slot: 'mcp' },
  { label: t('settings.memory'), icon: 'i-lucide-brain', value: 'memory', slot: 'memory' },
  { label: t('settings.agents'), icon: 'i-lucide-bot', value: 'agents', slot: 'agents' },
  { label: t('settings.skills'), icon: 'i-lucide-zap', value: 'skills', slot: 'skills' },
  { label: t('settings.hooks'), icon: 'i-lucide-webhook', value: 'hooks', slot: 'hooks' },
  { label: t('settings.appearance'), icon: 'i-lucide-palette', value: 'appearance', slot: 'appearance' },
])
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">{{ t('settings.title') }}</h1>

    <UTabs
      v-model="activeTab"
      :items="tabItems"
      variant="link"
      class="w-full"
      :unmount-on-hide="false"
    >
      <template #model>
        <div v-if="store.config" class="py-4">
          <SettingsModelConfig
            :config="store.config.model"
            :attribution="store.config.attribution"
          />
        </div>
      </template>

      <template #permissions>
        <div v-if="store.config" class="py-4">
          <SettingsPermissions :permissions="store.config.permissions" :mcp-servers="store.mcpServers" />
        </div>
      </template>

      <template #mcp>
        <div class="py-4">
          <SettingsMcpServers :servers="store.mcpServers" />
        </div>
      </template>

      <template #memory>
        <div class="py-4">
          <SettingsMemoryFiles :files="store.memoryFiles" />
        </div>
      </template>

      <template #agents>
        <div class="py-4">
          <SettingsAgents :agents="store.agents" />
        </div>
      </template>

      <template #skills>
        <div class="py-4">
          <SettingsSkills :skills="store.skills" />
        </div>
      </template>

      <template #hooks>
        <div class="py-4">
          <SettingsHooks :hooks="store.hooks" />
        </div>
      </template>

      <template #appearance>
        <div v-if="store.config" class="py-4">
          <SettingsAppearance :appearance="store.config.appearance" />
        </div>
      </template>
    </UTabs>
  </div>
</template>
