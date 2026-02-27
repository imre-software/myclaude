<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const kpis = computed(() => {
  const ov = store.filteredOverview
  if (!ov) return []

  return [
    {
      label: t('overview.totalTokens'),
      value: formatTokens(ov.totalTokens),
      icon: 'i-lucide-hash',
      source: 'local' as const,
    },
    {
      label: t('overview.totalCost'),
      value: formatCost(ov.totalCost),
      icon: 'i-lucide-dollar-sign',
      source: store.isMax ? 'local' as const : 'api' as const,
      estimated: store.isMax,
    },
    {
      label: t('overview.totalSessions'),
      value: ov.totalSessions.toLocaleString(),
      icon: 'i-lucide-messages-square',
      source: 'local' as const,
    },
    {
      label: t('overview.totalMessages'),
      value: ov.totalMessages.toLocaleString(),
      icon: 'i-lucide-message-circle',
      source: 'local' as const,
    },
  ]
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <template v-if="store.isLoading">
      <USkeleton v-for="i in 4" :key="i" class="h-24" />
    </template>
    <template v-else>
      <StatsKpiCard
        v-for="kpi in kpis"
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :icon="kpi.icon"
        :source="kpi.source"
        :estimated="kpi.estimated"
      />
    </template>
  </div>
</template>
