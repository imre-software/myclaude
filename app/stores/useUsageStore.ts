import type { UsageResponse } from '~/types/usage'

export const useUsageStore = defineStore('usage', () => {
  const data = ref<UsageResponse | null>(null)
  const isRefreshing = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  const isLoading = computed(() => !data.value && isRefreshing.value)

  function mergeResponse(fresh: UsageResponse): UsageResponse {
    if (fresh.rateLimits || !data.value?.rateLimits) return fresh
    return { ...fresh, rateLimits: data.value.rateLimits }
  }

  async function load() {
    if (data.value) return
    isRefreshing.value = true
    data.value = mergeResponse(await $fetch<UsageResponse>('/api/stats/usage'))
    isRefreshing.value = false
  }

  async function hardRefresh() {
    isRefreshing.value = true
    try {
      const fresh = await $fetch<UsageResponse>('/api/stats/usage', {
        query: { refresh: '1', t: Date.now() },
      })
      data.value = mergeResponse(fresh)
    } catch (err) {
      if (import.meta.dev) console.error('[usage] refresh failed:', err)
    } finally {
      isRefreshing.value = false
    }
  }

  function startAutoRefresh() {
    if (intervalId) return
    intervalId = setInterval(async () => {
      data.value = mergeResponse(await $fetch<UsageResponse>('/api/stats/usage'))
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
