<script setup lang="ts">
const { t } = useI18n()
const store = useStatsStore()
const { currentTotals, previousTotals, changes, canCompare } = useComparisonData()

interface KpiItem {
  label: string
  icon: string
  currentValue: string
  previousValue: string
  change: number | null
}

const kpis = computed<KpiItem[]>(() => {
  if (!canCompare.value) return []

  return [
    {
      label: t('overview.totalTokens'),
      icon: 'i-lucide-hash',
      currentValue: formatTokens(currentTotals.value.tokens),
      previousValue: formatTokens(previousTotals.value.tokens),
      change: changes.value.tokens,
    },
    {
      label: t('overview.totalCost'),
      icon: 'i-lucide-dollar-sign',
      currentValue: formatCost(currentTotals.value.cost),
      previousValue: formatCost(previousTotals.value.cost),
      change: changes.value.cost,
    },
    {
      label: t('overview.totalSessions'),
      icon: 'i-lucide-messages-square',
      currentValue: currentTotals.value.sessions.toLocaleString(),
      previousValue: previousTotals.value.sessions.toLocaleString(),
      change: changes.value.sessions,
    },
    {
      label: t('overview.totalMessages'),
      icon: 'i-lucide-message-circle',
      currentValue: currentTotals.value.messages.toLocaleString(),
      previousValue: previousTotals.value.messages.toLocaleString(),
      change: changes.value.messages,
    },
  ]
})

function formatChange(val: number | null): string {
  if (val === null) return '-'
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(1)}%`
}

function changeColor(val: number | null): string {
  if (val === null || val === 0) return 'text-neutral-500 dark:text-neutral-400'
  return val > 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
}

function changeIcon(val: number | null): string {
  if (val === null || val === 0) return 'i-lucide-minus'
  return val > 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <template v-if="store.isLoading">
      <USkeleton v-for="i in 4" :key="i" class="h-28" />
    </template>
    <template v-else>
      <UCard v-for="kpi in kpis" :key="kpi.label">
        <div class="flex items-start gap-4">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <UIcon :name="kpi.icon" class="size-5 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-sm text-muted truncate">{{ kpi.label }}</p>
            <p class="text-2xl font-semibold truncate">{{ kpi.currentValue }}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="inline-flex items-center gap-0.5" :class="changeColor(kpi.change)">
                <UIcon :name="changeIcon(kpi.change)" class="size-4" />
                <span class="text-sm font-medium">{{ formatChange(kpi.change) }}</span>
              </span>
              <span class="text-sm text-muted">
                {{ t('compare.previousPeriod') }}: {{ kpi.previousValue }}
              </span>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
