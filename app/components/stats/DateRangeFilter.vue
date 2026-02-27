<script setup lang="ts">
import type { DateRangePreset } from '~/types/stats'

const { t } = useI18n()
const store = useStatsStore()

const presets: Array<{ label: string, value: DateRangePreset }> = [
  { label: t('filters.today'), value: 'today' },
  { label: t('filters.last7d'), value: '7d' },
  { label: t('filters.last14d'), value: '14d' },
  { label: t('filters.last30d'), value: '30d' },
  { label: t('filters.allTime'), value: 'all' },
]

const isCustom = computed(() => store.dateRange.preset === 'custom')

const customRange = ref()

const handlePresetClick = (preset: DateRangePreset) => {
  store.dateRange = { preset }
}

watch(customRange, (value) => {
  if (!value?.start || !value?.end) return
  store.dateRange = {
    preset: 'custom',
    start: value.start.toString(),
    end: value.end.toString(),
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <UButton
      v-for="preset in presets"
      :key="preset.value"
      :label="preset.label"
      :variant="store.dateRange.preset === preset.value ? 'solid' : 'ghost'"
      :color="store.dateRange.preset === preset.value ? 'primary' : 'neutral'"
      size="sm"
      @click="handlePresetClick(preset.value)"
    />
    <UInputDate
      v-model="customRange"
      range
      size="sm"
      :variant="isCustom ? 'outline' : 'ghost'"
      :color="isCustom ? 'primary' : 'neutral'"
    />
  </div>
</template>
