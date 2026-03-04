import type { UsageResponse } from '~/types/usage'

export const useUsageStore = defineStore('usage', () => {
  const data = ref<UsageResponse | null>(null)
  const isRefreshing = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  const isLoading = computed(() => !data.value && isRefreshing.value)

  async function load() {
    if (data.value) return
    isRefreshing.value = true
    data.value = await $fetch<UsageResponse>('/api/stats/usage')
    isRefreshing.value = false
  }

  async function hardRefresh() {
    isRefreshing.value = true
    data.value = await $fetch<UsageResponse>('/api/stats/usage?refresh=1')
    isRefreshing.value = false
  }

  function startAutoRefresh() {
    if (intervalId) return
    intervalId = setInterval(async () => {
      data.value = await $fetch<UsageResponse>('/api/stats/usage')
    }, 60_000)
  }

  function stopAutoRefresh() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  return {
    data,
    isLoading,
    load,
    hardRefresh,
    startAutoRefresh,
    stopAutoRefresh,
  }
})
