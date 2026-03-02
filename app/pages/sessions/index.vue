<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

definePageMeta({
  layout: 'dashboard',
})

const rotationWarning = computed(() =>
  store.isAllTime
    ? t('source.jsonlRotationWarning', { date: store.overview?.firstSessionDate ? formatDate(store.overview.firstSessionDate) : '...' })
    : undefined,
)
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">{{ t('sessions.title') }}</h1>

    <StatsSessionsKpiGrid />
    <StatsDataSourceNote :text="t('source.sessionsNote')" :warning="rotationWarning" />
    <StatsSessionTable />
  </div>
</template>
