<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const models = computed(() => store.filteredModels?.models ?? [])

const chartData = computed(() => {
  return models.value.map(m => m.totalTokens)
})

const hasData = computed(() => {
  return chartData.value.length > 0 && chartData.value.some(v => v > 0)
})

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'] as const

const donutCategories = computed(() => {
  const result: Record<string, { name: string, color: string }> = {}
  models.value.forEach((m, i) => {
    const name = shortModelName(m.model)
    result[name] = { name, color: MODEL_COLORS[i % MODEL_COLORS.length]! }
  })
  return result
})
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-base font-semibold">{{ t('costs.distribution') }}</h3>
    </template>

    <div v-if="!hasData" class="flex h-48 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <div v-else class="flex items-center gap-6">
      <div class="shrink-0">
        <DonutChart
          :data="chartData"
          :categories="donutCategories"
          :height="160"
          :radius="4"
          :arc-width="18"
          :pad-angle="0.05"
          hide-legend
        />
      </div>

      <div class="flex min-w-0 flex-col gap-2">
        <div
          v-for="(model, i) in models"
          :key="model.model"
          class="flex items-center gap-2 text-sm"
        >
          <div class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }" />
          <span class="truncate">{{ shortModelName(model.model) }}</span>
          <span class="shrink-0 text-muted">{{ formatTokens(model.totalTokens) }}</span>
        </div>
      </div>
    </div>
  </UCard>
</template>
