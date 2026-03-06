import type { UsageResponse } from '~/types/usage'

export const useUsageStore = defineStore('usage', () => {
  const data = ref<UsageResponse | null>(null)
  const isRefreshing = ref(false)

  const isLoading = computed(() => !data.value && isRefreshing.value)

  async function load() {
    if (data.value) return
    isRefreshing.value = true
    const result = await $fetch<UsageResponse>('/api/stats/usage')
    console.log('[usage] load response:', {
      rateLimits: result.rateLimits,
      rateLimited: result.rateLimited,
    })
    data.value = result
    isRefreshing.value = false
  }

  async function hardRefresh() {
    isRefreshing.value = true
    try {
      const result = await $fetch<UsageResponse>('/api/stats/usage', {
        query: { refresh: '1', t: Date.now() },
      })
      console.log('[usage] refresh response:', {
        rateLimits: result.rateLimits,
        rateLimited: result.rateLimited,
      })
      data.value = result
    } catch (err) {
      console.error('[usage] refresh failed:', err)
    } finally {
      isRefreshing.value = false
    }
  }

  return {
    data,
    isLoading,
    load,
    hardRefresh,
  }
})
