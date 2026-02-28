<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const route = useRoute()
const statsStore = useStatsStore()

onMounted(() => {
  statsStore.startSync()
})

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
])
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-terminal" class="size-5 text-primary" />
            <span class="text-base font-semibold">Claude Stats</span>
          </div>
          <UButton
            icon="i-lucide-refresh-cw"
            variant="ghost"
            size="sm"
            :loading="statsStore.isSyncing"
            @click="statsStore.forceSync"
          />
        </div>
      </template>

      <UNavigationMenu
        :items="navItems"
        orientation="vertical"
      />
    </UDashboardSidebar>

    <UDashboardPanel>
      <StatsSyncProgress
        v-if="statsStore.isSyncing"
        :total="statsStore.syncTotal"
        :processed="statsStore.syncProcessed"
        :api-status="statsStore.apiSyncStatus"
        :api-windows-total="statsStore.apiWindowsTotal"
        :api-windows-processed="statsStore.apiWindowsProcessed"
        class="px-6"
      />
      <slot />
    </UDashboardPanel>
  </UDashboardGroup>
</template>
