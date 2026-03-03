<script setup lang="ts">
import type { HourlyUsageEntry } from '~~/app/types/usage'

const { t } = useI18n()

const props = defineProps<{
  hourly: HourlyUsageEntry[]
}>()

const formatHour = (hour: number): string => {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

const chartData = computed(() => {
  return props.hourly.map(h => ({
    hour: formatHour(h.hour),
    messages: h.messages,
  }))
})

const xFormatter = (index: number) => {
  return chartData.value[index]?.hour ?? ''
}

const peakHour = computed(() => {
  if (props.hourly.length === 0) return null
  const max = props.hourly.reduce((prev, curr) =>
    curr.messages > prev.messages ? curr : prev,
  )
  if (max.messages === 0) return null
  return { hour: formatHour(max.hour), count: max.messages }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold">{{ t('usage.hourlyActivity') }}</h3>
        <span v-if="peakHour" class="text-sm text-muted">
          {{ t('usage.peakHour', { hour: peakHour.hour, count: peakHour.count }) }}
        </span>
      </div>
    </template>

    <div v-if="chartData.length === 0" class="flex h-48 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <BarChart
      v-else
      :data="chartData"
      :categories="{ messages: { name: 'Messages', color: '#3b82f6' } }"
      :y-axis="['messages']"
      x-axis="hour"
      :height="240"
      :x-formatter="xFormatter"
      y-label="Messages"
      hide-legend
    />
  </UCard>
</template>
