<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const models = computed(() => store.filteredModels?.models ?? [])

const chartData = computed(() => {
  return models.value.map(m => m.totalTokens)
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

    <div v-if="chartData.length === 0" class="flex h-64 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <div v-else class="flex flex-col items-center">
      <DonutChart
        :data="chartData"
        :categories="donutCategories"
        :height="260"
        :radius="4"
        :arc-width="24"
        :pad-angle="0.05"
      />

      <div class="mt-4 flex flex-wrap justify-center gap-4">
        <div
          v-for="(model, i) in models"
          :key="model.model"
          class="flex items-center gap-2 text-sm"
        >
          <div class="size-3 rounded-full" :style="{ backgroundColor: ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'][i % 5] }" />
          <span>{{ shortModelName(model.model) }}</span>
          <span class="text-muted">{{ formatTokens(model.totalTokens) }}</span>
        </div>
      </div>
    </div>
  </UCard>
</template>
