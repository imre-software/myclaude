<script setup lang="ts">
import type { ProjectStats } from '~/types/stats'

const { t } = useI18n()
const store = useStatsStore()

definePageMeta({
  layout: 'dashboard',
})

const { data: projects, status } = useFetch<ProjectStats[]>('/api/stats/projects')

const rotationWarning = computed(() =>
  store.isAllTime ? t('source.jsonlRotationWarning') : undefined,
)
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">{{ t('projects.title') }}</h1>

    <StatsProjectsKpiGrid :projects="projects ?? []" />
    <StatsDataSourceNote :text="t('source.projectsNote')" :warning="rotationWarning" />
    <StatsProjectTable :projects="projects ?? []" :loading="status === 'pending'" />
  </div>
</template>
