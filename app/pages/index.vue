<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

definePageMeta({
  layout: 'dashboard',
})

const sourceNote = computed(() =>
  store.isMax ? t('source.overviewNoteMax') : t('source.overviewNote'),
)

const rotationWarning = computed(() =>
  store.isAllTime ? t('source.jsonlRotationWarning') : undefined,
)
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">{{ t('overview.title') }}</h1>
      <StatsFilterToolbar />
    </div>

    <StatsKpiGrid />
    <StatsDataSourceNote :text="sourceNote" :warning="rotationWarning" />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="lg:col-span-2">
        <StatsDailyActivityChart />
      </div>
      <StatsActivityHeatmap />
      <StatsModelDistributionChart />
    </div>
  </div>
</template>
