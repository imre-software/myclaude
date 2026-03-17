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
  store.isAllTime
    ? t('source.jsonlRotationWarning', { date: store.overview?.firstSessionDate ? formatDate(store.overview.firstSessionDate) : '...' })
    : undefined,
)
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <div class="sticky top-0 z-10 -mx-8 -mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-default bg-default px-8 py-6">
      <h1 class="text-2xl font-bold">{{ t('overview.title') }}</h1>
      <StatsFilterToolbar export-endpoint="/api/export/daily" export-filename="daily-activity" />
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
