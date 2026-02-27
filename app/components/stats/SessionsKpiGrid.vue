<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const { data } = useFetch('/api/stats/sessions-summary')
</script>

<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <StatsKpiCard
      :label="t('sessions.totalSessions')"
      :value="data ? data.totalSessions.toLocaleString() : '-'"
      icon="i-lucide-layers"
      source="local"
    />
    <StatsKpiCard
      :label="t('sessions.totalCost')"
      :value="data ? formatCost(data.totalCost) : '-'"
      icon="i-lucide-dollar-sign"
      source="local"
      :estimated="store.isMax"
    />
    <StatsKpiCard
      :label="t('sessions.avgCost')"
      :value="data ? formatCost(data.avgCost) : '-'"
      icon="i-lucide-calculator"
      source="local"
      :estimated="store.isMax"
    />
    <StatsKpiCard
      :label="t('sessions.avgDuration')"
      :value="data ? formatDuration(data.avgDuration) : '-'"
      icon="i-lucide-clock"
      source="local"
    />
  </div>
</template>
