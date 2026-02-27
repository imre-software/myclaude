<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const chartData = computed(() => {
  return store.filteredDaily.map(d => ({
    date: d.date,
    messages: d.messageCount,
    tokens: d.totalTokens,
  }))
})

const categories = {
  messages: { name: 'Messages', color: '#3b82f6' },
  tokens: { name: 'Tokens', color: '#8b5cf6' },
}

const xFormatter = (index: number) => {
  const item = chartData.value[index]
  if (!item) return ''
  const date = new Date(item.date)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-base font-semibold">{{ t('overview.dailyActivity') }}</h3>
    </template>

    <div v-if="chartData.length === 0" class="flex h-64 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <AreaChart
      v-else
      :data="chartData"
      :categories="{ messages: { name: 'Messages', color: '#3b82f6' } }"
      :height="300"
      :x-formatter="xFormatter"
      x-label="Date"
      y-label="Messages"
    />
  </UCard>
</template>
