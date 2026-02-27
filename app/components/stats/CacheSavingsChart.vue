<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const savings = computed(() => store.filteredModels?.cacheSavings)

const chartData = computed(() => {
  if (!savings.value) return []
  return [
    { label: 'Comparison', actual: Number(savings.value.actualCost.toFixed(2)), uncached: Number(savings.value.uncachedCost.toFixed(2)) },
  ]
})

const categories = {
  actual: { name: 'Actual Cost', color: '#22c55e' },
  uncached: { name: 'Without Cache', color: '#ef4444' },
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-base font-semibold">{{ t('costs.cacheSavings') }}</h3>
    </template>

    <div v-if="!savings" class="flex h-64 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <template v-else>
      <BarChart
        :data="chartData"
        :categories="categories"
        :y-axis="['actual', 'uncached']"
        x-axis="label"
        :height="250"
        y-label="Cost ($)"
      />

      <div class="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p class="text-sm text-muted">{{ t('costs.actualCost') }}</p>
          <p class="text-lg font-semibold text-green-600">{{ formatCost(savings.actualCost) }}</p>
        </div>
        <div>
          <p class="text-sm text-muted">{{ t('costs.uncachedCost') }}</p>
          <p class="text-lg font-semibold text-red-500">{{ formatCost(savings.uncachedCost) }}</p>
        </div>
        <div>
          <p class="text-sm text-muted">{{ t('costs.saved') }}</p>
          <p class="text-lg font-semibold text-primary">
            {{ formatCost(savings.saved) }}
            <span class="text-sm">({{ savings.savingsPercent.toFixed(1) }}%)</span>
          </p>
        </div>
      </div>
    </template>
  </UCard>
</template>
