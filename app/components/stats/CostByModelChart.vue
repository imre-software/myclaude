<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const chartData = computed(() => {
  if (!store.filteredModels?.models) return []
  return store.filteredModels.models.map(m => ({
    model: shortModelName(m.model),
    input: Number(m.inputCost.toFixed(2)),
    output: Number(m.outputCost.toFixed(2)),
    cacheRead: Number(m.cacheReadCost.toFixed(2)),
    cacheWrite: Number(m.cacheWriteCost.toFixed(2)),
  }))
})

const categories = {
  input: { name: 'Input', color: '#3b82f6' },
  output: { name: 'Output', color: '#8b5cf6' },
  cacheRead: { name: 'Cache Read', color: '#22c55e' },
  cacheWrite: { name: 'Cache Write', color: '#f59e0b' },
}

const xFormatter = (index: number) => {
  return chartData.value[index]?.model ?? ''
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-base font-semibold">{{ t('costs.byModel') }}</h3>
    </template>

    <div v-if="chartData.length === 0" class="flex h-64 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <BarChart
      v-else
      :data="chartData"
      :categories="categories"
      :y-axis="['input', 'output', 'cacheRead', 'cacheWrite']"
      x-axis="model"
      :height="300"
      :x-formatter="xFormatter"
      stacked
      y-label="Cost ($)"
    />
  </UCard>
</template>
