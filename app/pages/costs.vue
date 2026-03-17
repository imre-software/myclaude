<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

definePageMeta({
  layout: 'dashboard',
})

const sourceNote = computed(() =>
  store.isMax ? t('source.costsNoteMax') : t('source.costsNote'),
)

const rotationWarning = computed(() =>
  store.isAllTime
    ? t('source.jsonlRotationWarning', { date: store.overview?.firstSessionDate ? formatDate(store.overview.firstSessionDate) : '...' })
    : undefined,
)
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">{{ t('costs.title') }}</h1>
      <StatsFilterToolbar export-endpoint="/api/export/costs" export-filename="costs" />
    </div>

    <StatsDataSourceNote :text="sourceNote" :warning="rotationWarning" />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <StatsCostByModelChart />
      <StatsCacheSavingsChart />
      <div class="lg:col-span-2">
        <StatsModelDistributionChart />
      </div>
    </div>
  </div>
</template>
