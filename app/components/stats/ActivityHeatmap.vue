<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const hours = computed(() => {
  if (!store.hourly) return []
  return store.hourly
})

const maxCount = computed(() => {
  return Math.max(...hours.value.map(h => h.sessionCount), 1)
})

const getIntensity = (count: number): string => {
  if (count === 0) return 'bg-neutral-100 dark:bg-neutral-800'
  const ratio = count / maxCount.value
  if (ratio > 0.75) return 'bg-primary-500'
  if (ratio > 0.5) return 'bg-primary-400'
  if (ratio > 0.25) return 'bg-primary-300'
  return 'bg-primary-200'
}

const formatHour = (hour: number): string => {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-base font-semibold">{{ t('overview.activityHeatmap') }}</h3>
    </template>

    <div class="grid grid-cols-12 gap-1.5">
      <div
        v-for="entry in hours"
        :key="entry.hour"
        class="flex flex-col items-center gap-1"
      >
        <div
          class="size-8 rounded-md transition-colors"
          :class="getIntensity(entry.sessionCount)"
          :title="`${formatHour(entry.hour)}: ${entry.sessionCount} sessions`"
        />
        <span class="text-xs text-muted">{{ formatHour(entry.hour) }}</span>
      </div>
    </div>
  </UCard>
</template>
