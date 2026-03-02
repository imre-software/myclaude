<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  label: string
  rawValue: number | null
  formatter: (n: number) => string
  icon: string
  trend?: string
  source?: 'api' | 'local'
  estimated?: boolean
}>()

const displayValue = ref<string | null>(null)
let animationId = 0

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

watch(() => props.rawValue, (newVal, oldVal) => {
  if (newVal === null) return

  const from = oldVal ?? 0
  const to = newVal

  if (oldVal === null || oldVal === undefined) {
    displayValue.value = props.formatter(to)
    return
  }

  if (from === to) return

  cancelAnimationFrame(animationId)

  const duration = 600
  const start = performance.now()

  function tick(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeOutCubic(progress)
    const current = from + (to - from) * eased

    displayValue.value = props.formatter(current)

    if (progress < 1) {
      animationId = requestAnimationFrame(tick)
    }
  }

  animationId = requestAnimationFrame(tick)
}, { immediate: true })

onBeforeUnmount(() => cancelAnimationFrame(animationId))
</script>

<template>
  <UCard>
    <div class="flex items-center gap-4">
      <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <UIcon :name="icon" class="size-5 text-primary" />
      </div>
      <div class="min-w-0">
        <p class="text-sm text-muted truncate">{{ label }}</p>
        <p class="text-2xl font-semibold truncate">
          <template v-if="!displayValue">
            <span class="inline-block w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700">&nbsp;</span>
          </template>
          <template v-else>{{ displayValue }}</template>
        </p>
        <div v-if="displayValue && (trend || source || estimated)" class="flex items-center gap-2">
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
