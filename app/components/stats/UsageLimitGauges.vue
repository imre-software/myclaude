<script setup lang="ts">
import type { RateLimitInfo, PaceInfo, PaceProjection } from '~~/app/types/usage'

const { t } = useI18n()

const props = defineProps<{
  rateLimits: RateLimitInfo
  pace?: PaceInfo | null
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

function formatPaceTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`
  if (hours < 10) return `${hours.toFixed(1)}h`
  return `${Math.round(hours)}h`
}

interface GaugeItem {
  label: string
  utilization: number
  resetsAt: string | null
  pace: PaceProjection | null
}

const gauges = computed<GaugeItem[]>(() => {
  const p = props.pace
  const items: GaugeItem[] = [
    {
      label: t('usage.fiveHour'),
      utilization: props.rateLimits.fiveHour.utilization,
      resetsAt: props.rateLimits.fiveHour.resetsAt,
      pace: p?.fiveHour ?? null,
    },
    {
      label: t('usage.sevenDay'),
      utilization: props.rateLimits.sevenDay.utilization,
      resetsAt: props.rateLimits.sevenDay.resetsAt,
      pace: p?.sevenDay ?? null,
    },
  ]
  if (props.rateLimits.sevenDaySonnet) {
    items.push({
      label: t('usage.sevenDaySonnet'),
      utilization: props.rateLimits.sevenDaySonnet.utilization,
      resetsAt: props.rateLimits.sevenDaySonnet.resetsAt,
      pace: p?.sevenDaySonnet ?? null,
    })
  }
  if (props.rateLimits.sevenDayOpus) {
    items.push({
      label: t('usage.sevenDayOpus'),
      utilization: props.rateLimits.sevenDayOpus.utilization,
      resetsAt: props.rateLimits.sevenDayOpus.resetsAt,
      pace: p?.sevenDayOpus ?? null,
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
        <div v-if="gauge.pace" class="flex items-center gap-1.5">
          <template v-if="gauge.pace.willExhaust && gauge.pace.exhaustsInHours !== null">
            <UIcon
              :name="gauge.pace.status === 'critical' ? 'i-lucide-alert-triangle' : 'i-lucide-triangle-alert'"
              :class="gauge.pace.status === 'critical' ? 'size-4 text-red-500' : 'size-4 text-yellow-500'"
            />
            <span :class="gauge.pace.status === 'critical' ? 'text-sm text-red-500' : 'text-sm text-yellow-500'">
              {{ t('usage.paceExhausts', { time: formatPaceTime(gauge.pace.exhaustsInHours) }) }}
            </span>
          </template>
          <template v-else-if="gauge.pace.currentRatePerHour > 0">
            <UIcon name="i-lucide-check-circle" class="size-4 text-green-500" />
            <span class="text-sm text-green-500">
              {{ t('usage.paceOnTrackWithRate', { rate: gauge.pace.currentRatePerHour.toFixed(1) }) }}
            </span>
          </template>
          <template v-else>
            <UIcon name="i-lucide-check-circle" class="size-4 text-green-500" />
            <span class="text-sm text-green-500">{{ t('usage.paceOnTrack') }}</span>
          </template>
        </div>
      </div>
    </div>
  </UCard>
</template>
