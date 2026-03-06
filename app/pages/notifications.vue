<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { t } = useI18n()

definePageMeta({
  layout: 'dashboard',
})

const activeTab = ref('settings')

const tabItems = computed<TabsItem[]>(() => [
  { label: t('notifications.settingsTab'), icon: 'i-lucide-settings', value: 'settings', slot: 'settings' },
])
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">{{ t('notifications.title') }}</h1>

    <UTabs
      v-model="activeTab"
      :items="tabItems"
      variant="link"
      class="w-full"
      :unmount-on-hide="false"
    >
      <template #settings>
        <div class="py-4">
          <SettingsNotifications />
        </div>
      </template>
    </UTabs>
  </div>
</template>
