<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SessionSummary, ProjectStats } from '~/types/stats'

const { t } = useI18n()
const router = useRouter()
const store = useStatsStore()

const page = ref(1)
const limit = ref(25)
const selectedProject = ref<string | null>(null)

// Fetch available projects for the filter dropdown
const { data: projects } = useFetch<ProjectStats[]>('/api/stats/projects')

const projectOptions = computed(() => {
  const opts = (projects.value ?? []).map(p => ({ label: p.name, value: p.name }))
  return [{ label: t('sessions.allProjects'), value: null }, ...opts]
})

// Reset to page 1 when filters change
watch(() => [store.dateStart, store.dateEnd, selectedProject.value], () => {
  page.value = 1
})

const { data: response, status } = useFetch('/api/stats/sessions', {
  query: computed(() => ({
    page: page.value,
    limit: limit.value,
    sort: 'startTime',
    order: 'desc',
    from: store.dateStart || undefined,
    to: store.dateEnd || undefined,
    project: selectedProject.value || undefined,
  })),
})

const sessions = computed(() => response.value?.items ?? [])
const total = computed(() => response.value?.total ?? 0)
const totalPages = computed(() => response.value?.totalPages ?? 1)

const columns: TableColumn<SessionSummary>[] = [
  {
    accessorKey: 'startTime',
    header: t('sessions.date'),
    cell: ({ row }) => formatDateTime(row.getValue('startTime')),
  },
  {
    accessorKey: 'project',
    header: t('sessions.project'),
  },
  {
    accessorKey: 'model',
    header: t('sessions.model'),
    cell: ({ row }) => shortModelName(row.getValue('model') || ''),
  },
  {
    accessorKey: 'messageCount',
    header: t('sessions.messages'),
    meta: { class: { th: 'text-end', td: 'text-end' } },
  },
  {
    accessorKey: 'totalCost',
    header: t('sessions.cost'),
    meta: { class: { th: 'text-end', td: 'text-end' } },
    cell: ({ row }) => formatCost(row.getValue('totalCost')),
  },
  {
    accessorKey: 'duration',
    header: t('sessions.duration'),
    meta: { class: { th: 'text-end', td: 'text-end' } },
    cell: ({ row }) => formatDuration(row.getValue('duration')),
  },
]

const handleRowClick = (_e: Event, row: { original: SessionSummary }) => {
  router.push(`/sessions/${row.original.sessionId}`)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <USelect
        v-model="selectedProject"
        :items="projectOptions"
        :placeholder="t('sessions.filterByProject')"
        size="sm"
        class="w-60"
      />
    </div>

    <UTable
      :data="sessions"
      :columns="columns"
      :loading="status === 'pending'"
      sticky
      class="max-h-[600px] cursor-pointer"
      @select="handleRowClick"
    />

    <div v-if="totalPages > 1" class="flex justify-center">
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="limit"
      />
    </div>
  </div>
</template>
