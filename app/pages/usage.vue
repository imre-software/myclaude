<script setup lang="ts">
const { t } = useI18n()
const { data, hardRefresh, isLoading } = useUsageData()

definePageMeta({
  layout: 'dashboard',
})

function handleRefresh() {
  hardRefresh()
}
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <div class="sticky top-0 z-10 -mx-8 -mt-8 flex items-center justify-between border-b border-gray-200 bg-white px-8 py-6 dark:border-gray-800 dark:bg-gray-900">
      <h1 class="text-2xl font-bold">{{ t('usage.title') }}</h1>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        size="sm"
        :loading="isLoading"
        @click="handleRefresh"
      />
    </div>

    <template v-if="data">
      <StatsUsageLimitGauges
        v-if="data.rateLimits"
        :rate-limits="data.rateLimits"
      />

      <StatsUsageWindowGrid
        :five-hour="data.windows.fiveHour"
        :seven-day="data.windows.sevenDay"
        :today="data.windows.today"
        :month="data.windows.month"
      />

      <StatsUsageBurnRate :burn-rate="data.burnRate" />

      <StatsUsageContextBreakdown
        v-if="data.context.categories.length > 0"
        :context="data.context"
      />
    </template>

    <div v-else class="flex h-64 items-center justify-center text-muted">
      {{ t('common.loading') }}
    </div>
  </div>
</template>
