<script setup lang="ts">
const store = useStatsStore()

const props = defineProps<{
  total: number
  processed: number
  apiStatus: string
  apiWindowsTotal: number
  apiWindowsProcessed: number
}>()

const isSessionPhase = computed(() => props.total > 0 && props.processed < props.total)
const isApiRecent = computed(() => !store.isMax && props.apiStatus === 'syncing_recent')
const isApiHistory = computed(() => !store.isMax && props.apiStatus === 'syncing_history')
const isScanning = computed(() =>
  !isSessionPhase.value && !isApiRecent.value && !isApiHistory.value && props.apiStatus === 'idle',
)

const sessionPercent = computed(() =>
  props.total > 0 ? Math.round((props.processed / props.total) * 100) : 0,
)

const historyPercent = computed(() =>
  props.apiWindowsTotal > 0 ? Math.round((props.apiWindowsProcessed / props.apiWindowsTotal) * 100) : 0,
)
</script>

<template>
  <div class="flex flex-col gap-2 py-4">
    <!-- Scanning phase -->
    <template v-if="isScanning">
      <span class="text-base font-medium text-neutral-700 dark:text-neutral-300">
        Scanning sessions...
      </span>
      <UProgress size="md" />
    </template>

    <!-- Session indexing phase -->
    <template v-else-if="isSessionPhase">
      <div class="flex items-center justify-between">
        <span class="text-base font-medium text-neutral-700 dark:text-neutral-300">
          Indexing sessions...
        </span>
        <span class="text-sm text-neutral-500">
          {{ sessionPercent }}%
        </span>
      </div>
      <UProgress
        :model-value="processed"
        :max="total"
        size="md"
      />
    </template>

    <!-- API sync: fetching recent 30 days -->
    <template v-else-if="isApiRecent">
      <span class="text-base font-medium text-neutral-700 dark:text-neutral-300">
        Fetching billing data...
      </span>
      <UProgress size="md" />
    </template>

    <!-- API sync: fetching historical data -->
    <template v-else-if="isApiHistory">
      <div class="flex items-center justify-between">
        <span class="text-base font-medium text-neutral-700 dark:text-neutral-300">
          Syncing historical billing data...
        </span>
        <span class="text-sm text-neutral-500">
          {{ historyPercent }}%
        </span>
      </div>
      <UProgress
        :model-value="apiWindowsProcessed"
        :max="apiWindowsTotal"
        size="md"
      />
    </template>
  </div>
</template>
