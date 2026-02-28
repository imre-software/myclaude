<script setup lang="ts">
const { t } = useI18n()
const { chartData, currentDateLabel, previousDateLabel } = useComparisonData()

const props = defineProps<{
  metric: 'messages' | 'cost'
}>()

const data = computed(() => chartData.value[props.metric])

const title = computed(() =>
  props.metric === 'messages' ? t('compare.messages') : t('compare.cost'),
)

const categories = computed(() => ({
  current: { name: t('compare.currentPeriod'), color: '#3b82f6' },
  previous: { name: t('compare.previousPeriod'), color: '#9ca3af' },
}))

const xFormatter = (index: number) => {
  const item = data.value[index]
  if (!item) return ''
  return item.day
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h3 class="text-base font-semibold">{{ title }}</h3>
        <p v-if="currentDateLabel" class="text-sm text-muted mt-0.5">
          {{ currentDateLabel }} vs {{ previousDateLabel }}
        </p>
      </div>
    </template>

    <div v-if="data.length === 0" class="flex h-64 items-center justify-center text-muted">
      {{ t('common.noData') }}
    </div>
    <AreaChart
      v-else
      :data="data"
      :categories="categories"
      :height="300"
      :x-formatter="xFormatter"
      x-label="Day"
      :y-label="title"
    />
  </UCard>
</template>
