<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  label: string
  value: string
  icon: string
  trend?: string
  source?: 'api' | 'local'
  estimated?: boolean
}>()
</script>

<template>
  <UCard>
    <div class="flex items-center gap-4">
      <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <UIcon :name="icon" class="size-5 text-primary" />
      </div>
      <div class="min-w-0">
        <p class="text-sm text-muted truncate">{{ label }}</p>
        <p class="text-2xl font-semibold truncate">{{ value }}</p>
        <div v-if="trend || source || estimated" class="flex items-center gap-2">
          <p v-if="trend" class="text-sm text-muted">{{ trend }}</p>
          <span
            v-if="source"
            class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs"
            :class="source === 'api' ? 'bg-primary/10 text-primary' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'"
          >
            <UIcon :name="source === 'api' ? 'i-lucide-cloud' : 'i-lucide-hard-drive'" class="size-3" />
            {{ source === 'api' ? 'API' : 'Local' }}
          </span>
          <span
            v-if="estimated"
            class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          >
            <UIcon name="i-lucide-calculator" class="size-3" />
            {{ t('source.estimated') }}
          </span>
        </div>
      </div>
    </div>
  </UCard>
</template>
