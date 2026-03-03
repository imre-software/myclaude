<script setup lang="ts">
import type { WindowUsage } from '~~/app/types/usage'

const { t } = useI18n()

const props = defineProps<{
  fiveHour: WindowUsage
  sevenDay: WindowUsage
  today: WindowUsage
  month: WindowUsage
}>()

const windowEntries = computed(() => [
  { label: t('usage.fiveHour'), icon: 'i-lucide-clock', data: props.fiveHour },
  { label: t('usage.sevenDay'), icon: 'i-lucide-calendar-days', data: props.sevenDay },
  { label: t('usage.today'), icon: 'i-lucide-sun', data: props.today },
  { label: t('usage.month'), icon: 'i-lucide-calendar', data: props.month },
])
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <UCard v-for="entry in windowEntries" :key="entry.label">
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <UIcon :name="entry.icon" class="size-4 text-primary" />
          <span class="text-sm font-medium">{{ entry.label }}</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-sm text-muted">{{ t('usage.sessions') }}</p>
            <p class="text-lg font-semibold">{{ entry.data.sessions }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">{{ t('usage.messages') }}</p>
            <p class="text-lg font-semibold">{{ entry.data.messages }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">{{ t('usage.tokens') }}</p>
            <p class="text-lg font-semibold">{{ formatTokens(entry.data.inputTokens + entry.data.outputTokens) }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">{{ t('usage.cost') }}</p>
            <p class="text-lg font-semibold">{{ formatCost(entry.data.cost) }}</p>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
