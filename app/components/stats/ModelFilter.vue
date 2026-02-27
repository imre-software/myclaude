<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()

const modelOptions = computed(() =>
  store.availableModels.map(m => ({
    label: shortModelName(m),
    value: m,
  })),
)
</script>

<template>
  <USelectMenu
    v-model="store.selectedModels"
    :items="modelOptions"
    multiple
    :placeholder="t('filters.model')"
    class="w-48"
    size="sm"
    value-key="value"
  />
</template>
