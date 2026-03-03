<script setup lang="ts">
import type { ContextBreakdown } from '~~/app/types/usage'

const { t } = useI18n()

const props = defineProps<{
  context: ContextBreakdown
}>()

const expandedSlugs = ref<Set<string>>(new Set())

function toggleExpand(slug: string) {
  if (expandedSlugs.value.has(slug)) {
    expandedSlugs.value.delete(slug)
  } else {
    expandedSlugs.value.add(slug)
  }
  expandedSlugs.value = new Set(expandedSlugs.value)
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

const headerLine = computed(() => {
  return `${props.context.model} - ${fmtTokens(props.context.usedTokens)}/${fmtTokens(props.context.totalContextWindow)} tokens (${props.context.usedPercentage}%)`
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-semibold">{{ t('usage.contextBreakdown') }}</h3>
        <p class="text-sm text-muted font-mono">{{ headerLine }}</p>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium text-muted italic">{{ t('usage.estimatedUsage') }}</p>

        <div
          v-for="cat in context.categories"
          :key="cat.slug"
          class="flex flex-col"
        >
          <button
            v-if="cat.items.length > 0"
            class="flex items-center justify-between py-1 text-start hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -mx-2 transition-colors"
            @click="toggleExpand(cat.slug)"
          >
            <span class="text-sm">
              <UIcon
                :name="expandedSlugs.has(cat.slug) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="size-3.5 me-1 inline-block"
              />
              {{ cat.label }}
            </span>
            <span class="text-sm text-muted font-mono">{{ fmtTokens(cat.tokens) }} tokens ({{ cat.percentage }}%)</span>
          </button>
          <div v-else class="flex items-center justify-between py-1 px-2 -mx-2">
            <span class="text-sm">{{ cat.label }}</span>
            <span class="text-sm text-muted font-mono">{{ fmtTokens(cat.tokens) }} tokens ({{ cat.percentage }}%)</span>
          </div>

          <div
            v-if="expandedSlugs.has(cat.slug) && cat.items.length > 0"
            class="flex flex-col gap-0.5 ps-6 pb-1"
          >
            <div
              v-for="item in cat.items"
              :key="item.name"
              class="flex items-center justify-between py-0.5"
            >
              <span class="text-sm text-muted font-mono truncate">{{ item.name }}</span>
              <span class="text-sm text-muted font-mono shrink-0 ms-4">{{ fmtTokens(item.tokens) }} tokens</span>
            </div>
          </div>
        </div>
      </div>

      <USeparator />

      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between py-0.5 px-2 -mx-2">
          <span class="text-sm">{{ t('usage.freeSpace') }}</span>
          <span class="text-sm font-mono font-semibold text-primary">{{ fmtTokens(context.freeSpace) }} ({{ context.freeSpacePercentage }}%)</span>
        </div>
        <div class="flex items-center justify-between py-0.5 px-2 -mx-2">
          <span class="text-sm">{{ t('usage.autocompactBuffer') }}</span>
          <span class="text-sm text-muted font-mono">{{ fmtTokens(context.autocompactBuffer) }} tokens ({{ context.autocompactPercentage }}%)</span>
        </div>
      </div>
    </div>
  </UCard>
</template>
