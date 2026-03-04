<script setup lang="ts">
const { t } = useI18n()
const { data, startAutoRefresh, stopAutoRefresh } = useUsageData()

definePageMeta({
  layout: 'dashboard',
})

onMounted(() => startAutoRefresh())
onBeforeUnmount(() => stopAutoRefresh())
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">{{ t('usage.title') }}</h1>

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
