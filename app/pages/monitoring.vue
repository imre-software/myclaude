<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { t } = useI18n()

definePageMeta({
  layout: 'dashboard',
})

const activeTab = ref('thresholds')

const tabItems = computed<TabsItem[]>(() => [
  { label: t('notifications.thresholdAlertsTab'), icon: 'i-lucide-bell', value: 'thresholds', slot: 'thresholds' },
  { label: t('notifications.paceAlerts'), icon: 'i-lucide-trending-up', value: 'pace', slot: 'pace' },
  { label: t('whatsapp.tab'), icon: 'i-lucide-message-circle', value: 'whatsapp', slot: 'whatsapp' },
  { label: t('telegram.tab'), icon: 'i-lucide-send', value: 'telegram', slot: 'telegram' },
  { label: t('remote.tab'), icon: 'i-lucide-smartphone', value: 'remote', slot: 'remote' },
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
      <template #thresholds>
        <div class="py-4">
          <MonitoringThresholdAlerts />
        </div>
      </template>

      <template #pace>
        <div class="py-4">
          <MonitoringPaceAlerts />
        </div>
      </template>

      <template #whatsapp>
        <div class="py-4">
          <MonitoringWhatsAppConnect />
        </div>
      </template>

      <template #telegram>
        <div class="py-4">
          <MonitoringTelegramConnect />
        </div>
      </template>

      <template #remote>
        <div class="py-4">
          <MonitoringRemoteMode />
        </div>
      </template>
    </UTabs>
  </div>
</template>
