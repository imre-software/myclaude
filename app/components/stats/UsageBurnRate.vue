<script setup lang="ts">
import type { BurnRate } from '~~/app/types/usage'

const { t } = useI18n()

const props = defineProps<{
  burnRate: BurnRate
}>()

const tokensPerHour = computed(() => props.burnRate.tokensPerHour)
const costPerHour = computed(() => props.burnRate.costPerHour)
const messagesPerHour = computed(() => props.burnRate.messagesPerHour)
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <StatsKpiCard
      :label="t('usage.tokensPerHour')"
      :raw-value="tokensPerHour"
      :formatter="formatTokens"
      icon="i-lucide-zap"
    />
    <StatsKpiCard
      :label="t('usage.costPerHour')"
      :raw-value="costPerHour"
      :formatter="formatCost"
      icon="i-lucide-dollar-sign"
    />
    <StatsKpiCard
      :label="t('usage.messagesPerHour')"
      :raw-value="messagesPerHour"
      :formatter="(n: number) => n.toFixed(1)"
      icon="i-lucide-message-square"
    />
  </div>
</template>
