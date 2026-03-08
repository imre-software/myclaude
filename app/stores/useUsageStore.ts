import type { UsageResponse } from '~/types/usage'

async function emitUsageToTray(result: UsageResponse) {
  if (!(window as Record<string, unknown>).__TAURI_INTERNALS__) return
  if (!result.rateLimits) return

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('update_tray_usage', {
      fiveHour: result.rateLimits.fiveHour?.utilization ?? null,
      sevenDay: result.rateLimits.sevenDay?.utilization ?? null,
      sevenDaySonnet: result.rateLimits.sevenDaySonnet?.utilization ?? null,
    })
  } catch {
    // Tauri not available
  }
}

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
    emitUsageToTray(result)
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
      emitUsageToTray(result)
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
