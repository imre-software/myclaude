<script setup lang="ts">
const { t } = useI18n()
const { canCompare } = useComparisonData()

definePageMeta({
  layout: 'dashboard',
})
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">{{ t('compare.title') }}</h1>
      <StatsFilterToolbar />
    </div>

    <template v-if="canCompare">
      <StatsCompareKpiGrid />
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatsCompareChart metric="messages" />
        <StatsCompareChart metric="cost" />
      </div>
    </template>

    <UCard v-else>
      <div class="flex items-center gap-3 py-4">
        <UIcon name="i-lucide-info" class="size-5 text-primary shrink-0" />
        <p class="text-base text-muted">{{ t('compare.noComparison') }}</p>
      </div>
    </UCard>
  </div>
</template>
