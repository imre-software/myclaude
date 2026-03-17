<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const route = useRoute()
const statsStore = useStatsStore()
const settingsStore = useSettingsStore()
const usageStore = useUsageStore()
const notificationStore = useNotificationStore()

const isOnboarding = ref(false)
const isOnboardingChecked = ref(false)

onMounted(async () => {
  try {
    const status = await $fetch<{ completed: boolean }>('/api/onboarding/status')
    isOnboarding.value = !status.completed
  } catch {
    // If check fails, proceed normally
  }
  isOnboardingChecked.value = true

  if (!isOnboarding.value) {
    statsStore.startSync()
    settingsStore.loadAll()
    usageStore.load()
    notificationStore.init()
  }
})

function handleOnboardingComplete() {
  isOnboarding.value = false
  statsStore.startSync()
  settingsStore.loadAll()
  usageStore.load()
  notificationStore.init()
}

function handleRefresh() {
  statsStore.forceSync()
  settingsStore.loadAll()
  usageStore.hardRefresh()
}

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.overview'),
    icon: 'i-lucide-layout-dashboard',
    to: '/',
    active: route.path === '/',
  },
  {
    label: t('nav.compare'),
    icon: 'i-lucide-git-compare-arrows',
    to: '/compare',
    active: route.path === '/compare',
  },
  {
    label: t('nav.costs'),
    icon: 'i-lucide-dollar-sign',
    to: '/costs',
    active: route.path === '/costs',
  },
  {
    label: t('nav.sessions'),
    icon: 'i-lucide-messages-square',
    to: '/sessions',
    active: route.path.startsWith('/sessions'),
  },
  {
    label: t('nav.projects'),
    icon: 'i-lucide-folder-kanban',
    to: '/projects',
    active: route.path === '/projects',
  },
  {
    label: t('nav.usage'),
    icon: 'i-lucide-gauge',
    to: '/usage',
    active: route.path === '/usage',
  },
  {
    label: t('nav.monitoring'),
    icon: 'i-lucide-activity',
    to: '/monitoring',
    active: route.path === '/monitoring',
  },
  {
    label: t('nav.settings'),
    icon: 'i-lucide-settings',
    to: '/settings',
    active: route.path === '/settings',
  },
])

// Sync display modes
// Sync display modes
const isFirstSync = computed(() =>
  statsStore.isSyncing && (!statsStore.overview || statsStore.overview.totalSessions === 0),
)

const isResync = computed(() =>
  statsStore.isSyncing && !isFirstSync.value,
)

// Shared progress computations
const syncProgressValue = computed<number | null>(() => {
  if (statsStore.syncTotal > 0 && statsStore.syncProcessed < statsStore.syncTotal) {
    return statsStore.syncProcessed
  }
  if (statsStore.apiSyncStatus === 'syncing_history' && statsStore.apiWindowsTotal > 0) {
    return statsStore.apiWindowsProcessed
  }
  return null
})

const syncProgressMax = computed<number | undefined>(() => {
  if (statsStore.syncTotal > 0 && statsStore.syncProcessed < statsStore.syncTotal) {
    return statsStore.syncTotal
  }
  if (statsStore.apiSyncStatus === 'syncing_history' && statsStore.apiWindowsTotal > 0) {
    return statsStore.apiWindowsTotal
  }
  return undefined
})

const syncPhaseText = computed(() => {
  if (statsStore.syncTotal > 0 && statsStore.syncProcessed < statsStore.syncTotal) {
    return 'Indexing sessions...'
  }
  if (!statsStore.isMax && statsStore.apiSyncStatus === 'syncing_recent') {
    return 'Fetching billing data...'
  }
  if (!statsStore.isMax && statsStore.apiSyncStatus === 'syncing_history') {
    return 'Syncing historical billing data...'
  }
  return 'Scanning sessions...'
})

const syncPercent = computed<number | null>(() => {
  const val = syncProgressValue.value
  const max = syncProgressMax.value
  if (val !== null && max) {
    return Math.round((val / max) * 100)
  }
  return null
})
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar :ui="{ root: 'bg-default' }">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-terminal" class="size-5 text-primary" />
            <span class="text-base font-semibold">My Claude</span>
          </div>
          <UButton
            icon="i-lucide-rotate-cw"
            variant="ghost"
            size="sm"
            :loading="statsStore.isSyncing"
            @click="handleRefresh"
          />
        </div>
      </template>

      <UNavigationMenu
        :items="navItems"
        orientation="vertical"
      />

      <template #footer>
        <div class="flex items-center justify-between px-2">
          <span class="text-sm text-muted">v0.1.0</span>
          <UColorModeButton class="cursor-pointer" />
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel :ui="{ root: 'bg-default', body: 'p-0 sm:p-0 gap-0' }">
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>

  <!-- Auto-update banner -->
  <UpdateBanner />

  <!-- Onboarding wizard -->
  <UModal
    :open="isOnboarding && isOnboardingChecked"
    :dismissible="false"
    :close="false"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #content>
      <OnboardingWizard @complete="handleOnboardingComplete" />
    </template>
  </UModal>

  <!-- First sync: centered modal -->
  <UModal
    :open="isFirstSync"
    :dismissible="false"
    :close="false"
  >
    <template #content>
      <div class="flex flex-col items-center gap-6 px-8 py-10">
        <UIcon name="i-lucide-terminal" class="size-10 text-primary" />
        <div class="flex flex-col items-center gap-1 text-center">
          <h2 class="text-lg font-semibold">Setting up your dashboard</h2>
          <p class="text-sm text-muted">{{ syncPhaseText }}</p>
        </div>
        <div class="w-full max-w-xs">
          <UProgress
            :model-value="syncProgressValue"
            :max="syncProgressMax"
            :ui="{ base: 'h-1.5' }"
          />
          <p v-if="syncPercent !== null" class="mt-2 text-center text-sm text-muted">
            {{ syncPercent }}%
          </p>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Re-sync: turbolinks-style top bar -->
  <Transition
    enter-active-class="transition-opacity duration-300"
    leave-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="isResync" class="fixed inset-x-0 top-0 z-50">
      <UProgress
        :model-value="syncProgressValue"
        :max="syncProgressMax"
        :ui="{ base: 'h-1 rounded-none', indicator: 'rounded-none' }"
      />
    </div>
  </Transition>
</template>
