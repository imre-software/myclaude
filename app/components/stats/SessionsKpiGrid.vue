<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

// Use store for totalSessions/totalCost (matches overview), API for avgDuration
const { data: summary } = useFetch('/api/stats/sessions-summary', {
  query: computed(() => ({
    from: store.dateStart || undefined,
    to: store.dateEnd || undefined,
  })),
})

const totalSessions = computed(() => store.filteredOverview?.totalSessions ?? null)
const totalCost = computed(() => store.filteredOverview?.totalCost ?? null)
const avgCost = computed(() => {
  if (!totalCost.value || !totalSessions.value) return null
  return totalCost.value / totalSessions.value
})
const avgDuration = computed(() => summary.value?.avgDuration ?? null)
</script>

<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <StatsKpiCard
      :label="t('sessions.totalSessions')"
      :raw-value="totalSessions"
      :formatter="(n: number) => Math.round(n).toLocaleString()"
      icon="i-lucide-layers"
      source="local"
    />
    <StatsKpiCard
      :label="t('sessions.totalCost')"
      :raw-value="totalCost"
      :formatter="formatCost"
      icon="i-lucide-dollar-sign"
      source="local"
      :estimated="store.isMax"
    />
    <StatsKpiCard
      :label="t('sessions.avgCost')"
      :raw-value="avgCost"
      :formatter="formatCost"
      icon="i-lucide-calculator"
      source="local"
      :estimated="store.isMax"
    />
    <StatsKpiCard
      :label="t('sessions.avgDuration')"
      :raw-value="avgDuration"
      :formatter="formatDuration"
      icon="i-lucide-clock"
      source="local"
    />
  </div>
</template>
