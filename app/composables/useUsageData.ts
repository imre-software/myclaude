import type { UsageResponse } from '~~/app/types/usage'

export function useUsageData() {
  const forceRefresh = ref(false)
  const url = computed(() =>
    forceRefresh.value ? '/api/stats/usage?refresh=1' : '/api/stats/usage',
  )

  const { data, refresh, status } = useFetch<UsageResponse>(url)

  let intervalId: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    intervalId = setInterval(() => refresh(), 60_000)
  })

  onBeforeUnmount(() => {
    if (intervalId) clearInterval(intervalId)
  })

  const isLoading = computed(() => status.value === 'pending')

  const hardRefresh = async () => {
    forceRefresh.value = true
    await refresh()
    forceRefresh.value = false
  }

  return {
    data,
    refresh,
    hardRefresh,
    isLoading,
  }
}
