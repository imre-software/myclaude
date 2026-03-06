import type { UsageResponse } from '~/types/usage'

export const useUsageStore = defineStore('usage', () => {
  const data = ref<UsageResponse | null>(null)
  const isRefreshing = ref(false)

  const isLoading = computed(() => !data.value && isRefreshing.value)

  async function load() {
    if (data.value) return
    isRefreshing.value = true
    data.value = await $fetch<UsageResponse>('/api/stats/usage')
    isRefreshing.value = false
  }

  async function hardRefresh() {
    isRefreshing.value = true
    try {
      data.value = await $fetch<UsageResponse>('/api/stats/usage', {
        query: { refresh: '1', t: Date.now() },
      })
    } catch (err) {
      if (import.meta.dev) console.error('[usage] refresh failed:', err)
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
