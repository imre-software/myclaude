<script setup lang="ts">
const store = useStatsStore()

const props = defineProps<{
  exportEndpoint?: string
  exportFilename?: string
}>()

const exportQueryParams = computed(() => ({
  from: store.dateStart || undefined,
  to: store.dateEnd || undefined,
}))
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <StatsDateRangeFilter />
    <StatsModelFilter />
    <div class="flex items-center gap-1 ms-auto">
      <StatsExportButton
        v-if="props.exportEndpoint"
        :endpoint="props.exportEndpoint"
        :filename="props.exportFilename ?? 'export'"
        :query-params="exportQueryParams"
      />
      <NotificationCenter />
    </div>
  </div>
</template>
