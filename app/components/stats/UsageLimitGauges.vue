<script setup lang="ts">
import type { RateLimitInfo } from '~~/app/types/usage'

const { t } = useI18n()

const props = defineProps<{
  rateLimits: RateLimitInfo
}>()

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

function formatResetDateTime(resetsAt: string | null): string {
  if (!resetsAt) return ''
  const date = new Date(resetsAt)
  const isToday = new Date().toDateString() === date.toDateString()
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const datePart = isToday ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' at '
  return `${datePart}${timePart} (${timezone})`
}

function gaugeColor(utilization: number): 'primary' | 'warning' | 'error' {
  if (utilization >= 80) return 'error'
  if (utilization >= 50) return 'warning'
  return 'primary'
}

interface GaugeItem {
  label: string
  utilization: number
  resetsAt: string | null
}

const gauges = computed<GaugeItem[]>(() => {
  const items: GaugeItem[] = [
    {
      label: t('usage.fiveHour'),
      utilization: props.rateLimits.fiveHour.utilization,
      resetsAt: props.rateLimits.fiveHour.resetsAt,
    },
    {
      label: t('usage.sevenDay'),
      utilization: props.rateLimits.sevenDay.utilization,
      resetsAt: props.rateLimits.sevenDay.resetsAt,
    },
  ]
  if (props.rateLimits.sevenDaySonnet) {
    items.push({
      label: t('usage.sevenDaySonnet'),
      utilization: props.rateLimits.sevenDaySonnet.utilization,
      resetsAt: props.rateLimits.sevenDaySonnet.resetsAt,
    })
  }
  if (props.rateLimits.sevenDayOpus) {
    items.push({
      label: t('usage.sevenDayOpus'),
      utilization: props.rateLimits.sevenDayOpus.utilization,
      resetsAt: props.rateLimits.sevenDayOpus.resetsAt,
    })
  }
  return items
})
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-base font-semibold">{{ t('usage.rateLimits') }}</h3>
    </template>

    <div class="flex flex-col gap-5">
      <div v-for="gauge in gauges" :key="gauge.label" class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ gauge.label }}</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">{{ Math.round(gauge.utilization) }}%</span>
            <span v-if="gauge.resetsAt" class="text-sm text-muted">
              {{ t('usage.resetsAt', { time: formatResetDateTime(gauge.resetsAt) }) }}
            </span>
          </div>
        </div>
        <UProgress
          :model-value="gauge.utilization"
          :max="100"
          :color="gaugeColor(gauge.utilization)"
          size="md"
        />
      </div>
    </div>
  </UCard>
</template>
