<script setup lang="ts">
import type { NotificationRecord } from '~/types/notifications'

const { t } = useI18n()
const store = useNotificationStore()

const isOpen = ref(false)
const history = ref<NotificationRecord[]>([])
const isLoading = ref(false)

const handleOpen = async (open: boolean) => {
  isOpen.value = open
  if (open) {
    isLoading.value = true
    try {
      history.value = await $fetch<NotificationRecord[]>('/api/notifications/history?limit=50')
    } finally {
      isLoading.value = false
    }
  }
}

const handleMarkAllRead = async () => {
  await $fetch('/api/notifications/read', { method: 'PUT', body: {} })
  history.value = history.value.map(n => ({ ...n, read: true }))
  store.unreadCount = 0
}

const handleMarkRead = async (id: number) => {
  await $fetch('/api/notifications/read', { method: 'PUT', body: { id } })
  const item = history.value.find(n => n.id === id)
  if (item && !item.read) {
    item.read = true
    store.unreadCount = Math.max(0, store.unreadCount - 1)
  }
}

const notificationIcon = (type: string) => {
  if (type === 'threshold') return 'i-lucide-triangle-alert'
  if (type === 'pace') return 'i-lucide-trending-up'
  return 'i-lucide-bell'
}

const formatTime = (isoDate: string) => {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)

  if (diffMins < 1) return t('notificationCenter.justNow')
  if (diffMins < 60) return t('notificationCenter.minutesAgo', { count: diffMins })
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return t('notificationCenter.hoursAgo', { count: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  return t('notificationCenter.daysAgo', { count: diffDays })
}
</script>

<template>
  <UPopover :open="isOpen" @update:open="handleOpen">
    <UButton
      icon="i-lucide-bell"
      variant="ghost"
      size="sm"
      class="relative"
    >
      <template v-if="store.unreadCount > 0" #trailing>
        <UBadge
          :label="store.unreadCount > 99 ? '99+' : String(store.unreadCount)"
          size="xs"
          color="error"
          class="absolute -end-1 -top-1 min-w-5 justify-center"
        />
      </template>
    </UButton>

    <template #content>
      <div class="w-80 max-h-96 flex flex-col">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <span class="text-base font-semibold">{{ t('notificationCenter.title') }}</span>
          <UButton
            v-if="store.unreadCount > 0"
            :label="t('notificationCenter.markAllRead')"
            variant="link"
            size="xs"
            @click="handleMarkAllRead"
          />
        </div>

        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="size-5 animate-spin text-muted" />
        </div>

        <div v-else-if="history.length === 0" class="flex flex-col items-center gap-2 py-8 text-muted">
          <UIcon name="i-lucide-bell-off" class="size-8" />
          <span class="text-sm">{{ t('notificationCenter.empty') }}</span>
        </div>

        <div v-else class="overflow-y-auto">
          <button
            v-for="item in history"
            :key="item.id"
            class="flex w-full cursor-pointer gap-3 px-4 py-3 text-start transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            :class="{ 'bg-primary-50/50 dark:bg-primary-900/10': !item.read }"
            @click="handleMarkRead(item.id)"
          >
            <UIcon
              :name="notificationIcon(item.type)"
              class="mt-0.5 size-4 shrink-0"
              :class="item.type === 'threshold' ? 'text-amber-500' : 'text-blue-500'"
            />
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-sm font-medium" :class="{ 'font-semibold': !item.read }">
                {{ item.title }}
              </span>
              <span class="text-sm text-muted line-clamp-2">{{ item.body }}</span>
              <span class="text-xs text-muted">{{ formatTime(item.createdAt) }}</span>
            </div>
            <div v-if="!item.read" class="ms-auto mt-1 size-2 shrink-0 rounded-full bg-primary" />
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>
