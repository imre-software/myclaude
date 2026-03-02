<script setup lang="ts">
import type { ProjectStats } from '~/types/stats'

const { t } = useI18n()
const store = useStatsStore()

const props = defineProps<{
  projects: ProjectStats[]
}>()

const totalProjects = computed(() => props.projects.length)

const totalCost = computed(() => store.filteredOverview?.totalCost ?? 0)

const mostActive = computed(() => {
  if (props.projects.length === 0) return '-'
  const sorted = [...props.projects].sort((a, b) => b.sessionCount - a.sessionCount)
  return sorted[0]!.name
})

const highestCost = computed(() => {
  if (props.projects.length === 0) return { name: '-', cost: 0 }
  const sorted = [...props.projects].sort((a, b) => b.totalCost - a.totalCost)
  const top = sorted[0]!
  return { name: top.name, cost: top.totalCost }
})
</script>

<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <StatsKpiCard
      :label="t('projects.totalProjects')"
      :raw-value="totalProjects"
      :formatter="(n: number) => Math.round(n).toLocaleString()"
      icon="i-lucide-folder"
      source="local"
    />
    <StatsKpiCard
      :label="t('projects.mostActive')"
      :raw-value="mostActive === '-' ? null : 1"
      :formatter="() => mostActive"
      icon="i-lucide-activity"
      source="local"
    />
    <StatsKpiCard
      :label="t('projects.highestCost')"
      :raw-value="highestCost.cost > 0 ? highestCost.cost : null"
      :formatter="() => highestCost.name"
      :trend="highestCost.cost > 0 ? formatCost(highestCost.cost) : undefined"
      icon="i-lucide-trending-up"
      source="local"
      :estimated="store.isMax"
    />
    <StatsKpiCard
      :label="t('projects.totalCost')"
      :raw-value="totalCost"
      :formatter="formatCost"
      icon="i-lucide-dollar-sign"
      source="local"
      :estimated="store.isMax"
    />
  </div>
</template>
