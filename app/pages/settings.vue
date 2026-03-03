<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { t } = useI18n()

definePageMeta({
  layout: 'dashboard',
})

const {
  config,
  mcpServers,
  memoryFiles,
  agents,
  skills,
  hooks,
  isLoading,
} = useSettingsData()

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

    <div v-if="isLoading" class="flex h-64 items-center justify-center text-muted">
      {{ t('common.loading') }}
    </div>

    <UTabs
      v-else
      :items="tabItems"
      default-value="model"
      variant="link"
      class="w-full"
      :unmount-on-hide="false"
    >
      <template #model>
        <div v-if="config" class="py-4">
          <SettingsModelConfig
            :config="config.model"
            :attribution="config.attribution"
          />
        </div>
      </template>

      <template #permissions>
        <div v-if="config" class="py-4">
          <SettingsPermissions :permissions="config.permissions" />
        </div>
      </template>

      <template #mcp>
        <div class="py-4">
          <SettingsMcpServers :servers="mcpServers ?? []" />
        </div>
      </template>

      <template #memory>
        <div class="py-4">
          <SettingsMemoryFiles :files="memoryFiles ?? []" />
        </div>
      </template>

      <template #agents>
        <div class="py-4">
          <SettingsAgents :agents="agents ?? []" />
        </div>
      </template>

      <template #skills>
        <div class="py-4">
          <SettingsSkills :skills="skills ?? []" />
        </div>
      </template>

      <template #hooks>
        <div class="py-4">
          <SettingsHooks :hooks="hooks ?? []" />
        </div>
      </template>

      <template #appearance>
        <div v-if="config" class="py-4">
          <SettingsAppearance :appearance="config.appearance" />
        </div>
      </template>
    </UTabs>
  </div>
</template>
