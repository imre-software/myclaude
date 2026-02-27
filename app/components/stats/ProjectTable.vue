<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProjectStats } from '~/types/stats'

const { t } = useI18n()

defineProps<{
  projects: ProjectStats[]
  loading?: boolean
}>()

const columns: TableColumn<ProjectStats>[] = [
  {
    accessorKey: 'name',
    header: t('projects.name'),
  },
  {
    accessorKey: 'sessionCount',
    header: t('projects.sessions'),
    meta: { class: { th: 'text-end', td: 'text-end' } },
  },
  {
    accessorKey: 'messageCount',
    header: t('projects.messages'),
    meta: { class: { th: 'text-end', td: 'text-end' } },
    cell: ({ row }) => row.getValue<number>('messageCount').toLocaleString(),
  },
  {
    accessorKey: 'totalTokens',
    header: t('projects.tokens'),
    meta: { class: { th: 'text-end', td: 'text-end' } },
    cell: ({ row }) => formatTokens(row.getValue('totalTokens')),
  },
  {
    accessorKey: 'totalCost',
    header: t('projects.cost'),
    meta: { class: { th: 'text-end', td: 'text-end' } },
    cell: ({ row }) => formatCost(row.getValue('totalCost')),
  },
  {
    accessorKey: 'lastActive',
    header: t('projects.lastActive'),
    cell: ({ row }) => formatDate(row.getValue('lastActive')),
  },
]
</script>

<template>
  <UTable
    :data="projects"
    :columns="columns"
    :loading="loading"
    sticky
    class="max-h-[600px]"
  />
</template>
