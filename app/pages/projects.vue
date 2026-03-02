<script setup lang="ts">
import type { ProjectStats } from '~/types/stats'

const { t } = useI18n()
const store = useStatsStore()

definePageMeta({
  layout: 'dashboard',
})

const { data: projects, status } = useFetch<ProjectStats[]>('/api/stats/projects', {
  query: computed(() => ({
    from: store.dateStart || undefined,
    to: store.dateEnd || undefined,
  })),
})

const rotationWarning = computed(() =>
  store.isAllTime
    ? t('source.jsonlRotationWarning', { date: store.overview?.firstSessionDate ? formatDate(store.overview.firstSessionDate) : '...' })
    : undefined,
)
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">{{ t('projects.title') }}</h1>
      <StatsFilterToolbar />
    </div>

    <StatsProjectsKpiGrid :projects="projects ?? []" />
    <StatsDataSourceNote :text="t('source.projectsNote')" :warning="rotationWarning" />
    <StatsProjectTable :projects="projects ?? []" :loading="status === 'pending'" />
  </div>
</template>
