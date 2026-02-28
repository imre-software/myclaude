<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const hours = computed(() => {
  if (!store.hourly) return []
  return store.hourly
})

const formatHour = (hour: number): string => {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

const chartData = computed(() => {
  return hours.value.map(h => ({
    hour: formatHour(h.hour),
    sessions: h.sessionCount,
  }))
})

const xFormatter = (index: number) => {
  return chartData.value[index]?.hour ?? ''
}

const peakHour = computed(() => {
  if (hours.value.length === 0) return null
  const max = hours.value.reduce((prev, curr) =>
    curr.sessionCount > prev.sessionCount ? curr : prev,
  )
  if (max.sessionCount === 0) return null
  return { hour: formatHour(max.hour), count: max.sessionCount }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold">{{ t('overview.activityHeatmap') }}</h3>
        <span v-if="peakHour" class="text-sm text-muted">
          Peak: {{ peakHour.hour }} ({{ peakHour.count }} sessions)
        </span>
      </div>
    </template>

    <div v-if="chartData.length === 0" class="flex h-48 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <BarChart
      v-else
      :data="chartData"
      :categories="{ sessions: { name: 'Sessions', color: '#3b82f6' } }"
      :y-axis="['sessions']"
      x-axis="hour"
      :height="240"
      :x-formatter="xFormatter"
      y-label="Sessions"
      hide-legend
    />
  </UCard>
</template>
