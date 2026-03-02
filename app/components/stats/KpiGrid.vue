<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const formatInteger = (n: number) => Math.round(n).toLocaleString()

const kpis = computed(() => {
  const ov = store.filteredOverview
  return [
    {
      label: t('overview.totalTokens'),
      icon: 'i-lucide-hash',
      source: 'local' as const,
      rawValue: ov?.totalTokens ?? null,
      formatter: formatTokens,
    },
    {
      label: t('overview.totalCost'),
      icon: 'i-lucide-dollar-sign',
      source: store.isMax ? 'local' as const : 'api' as const,
      estimated: store.isMax,
      rawValue: ov?.totalCost ?? null,
      formatter: formatCost,
    },
    {
      label: t('overview.totalSessions'),
      icon: 'i-lucide-messages-square',
      source: 'local' as const,
      rawValue: ov?.totalSessions ?? null,
      formatter: formatInteger,
    },
    {
      label: t('overview.totalMessages'),
      icon: 'i-lucide-message-circle',
      source: 'local' as const,
      rawValue: ov?.totalMessages ?? null,
      formatter: formatInteger,
    },
  ]
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatsKpiCard
      v-for="kpi in kpis"
      :key="kpi.label"
      :label="kpi.label"
      :raw-value="kpi.rawValue"
      :formatter="kpi.formatter"
      :icon="kpi.icon"
      :source="kpi.source"
      :estimated="kpi.estimated"
    />
  </div>
</template>
