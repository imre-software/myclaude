<script setup lang="ts">
const { t } = useI18n()
const store = useUsageData()

definePageMeta({
  layout: 'dashboard',
})
</script>

<template>
  <div class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-bold">{{ t('usage.title') }}</h1>

    <template v-if="store.data">
      <UAlert
        v-if="store.data.rateLimited"
        color="warning"
        icon="i-lucide-alert-triangle"
        :title="store.data.rateLimits ? t('usage.rateLimited') : t('usage.rateLimitedNoData')"
      />

      <StatsUsageLimitGauges
        v-if="store.data.rateLimits"
        :rate-limits="store.data.rateLimits"
        :pace="store.data.pace"
      />

      <StatsUsageWindowGrid
        :five-hour="store.data.windows.fiveHour"
        :seven-day="store.data.windows.sevenDay"
        :today="store.data.windows.today"
        :month="store.data.windows.month"
      />

      <StatsUsageBurnRate :burn-rate="store.data.burnRate" />

      <StatsUsageContextBreakdown
        v-if="store.data.context.categories.length > 0"
        :context="store.data.context"
      />
    </template>

    <div v-else class="flex h-64 items-center justify-center text-muted">
      {{ t('common.loading') }}
    </div>
  </div>
</template>
