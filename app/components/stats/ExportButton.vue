<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { t } = useI18n()

const props = defineProps<{
  endpoint: string
  filename: string
  queryParams?: Record<string, string | undefined>
}>()

const isExporting = ref(false)

const handleExport = async (format: 'csv' | 'json') => {
  isExporting.value = true
  try {
    const params = new URLSearchParams()
    params.set('format', format)
    if (props.queryParams) {
      for (const [key, value] of Object.entries(props.queryParams)) {
        if (value) params.set(key, value)
      }
    }

    const response = await $fetch.raw(`${props.endpoint}?${params.toString()}`)
    const blob = new Blob(
      [typeof response._data === 'string' ? response._data : JSON.stringify(response._data, null, 2)],
      { type: format === 'csv' ? 'text/csv' : 'application/json' },
    )

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.filename}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    isExporting.value = false
  }
}

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('export.csv'),
      icon: 'i-lucide-file-spreadsheet',
      onSelect: () => handleExport('csv'),
    },
    {
      label: t('export.json'),
      icon: 'i-lucide-file-json',
      onSelect: () => handleExport('json'),
    },
  ],
])
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      icon="i-lucide-download"
      variant="ghost"
      size="sm"
      :loading="isExporting"
    />
  </UDropdownMenu>
</template>
