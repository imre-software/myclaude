<script setup lang="ts">
import type { NotificationRecord, NotificationWindowType } from '~/types/notifications'

const { t } = useI18n()
const store = useNotificationStore()

const presetLevels = [70, 80, 90, 100]

const windowConfigs: Array<{ key: NotificationWindowType, label: string }> = [
  { key: 'fiveHour', label: t('notifications.fiveHourWindow') },
  { key: 'sevenDay', label: t('notifications.sevenDayWindow') },
  { key: 'sevenDaySonnet', label: t('notifications.sevenDaySonnetWindow') },
]

const customLevelInput = ref('')

interface PaceWindowInfo {
  key: string
  label: string
  utilization: number | null
  resetsAt: string | null
  ratePerHour: number | null
  exhaustsAt: string | null
  willExhaust: boolean
  status: 'on-track' | 'warning' | 'critical'
}

const windows = ref<PaceWindowInfo[]>([])
const paceHistory = ref<NotificationRecord[]>([])
const isLoading = ref(true)

onMounted(async () => {
  await Promise.all([
    $fetch<{ windows: PaceWindowInfo[] }>('/api/stats/pace')
      .then(res => { windows.value = res.windows })
      .catch(() => {}),
    $fetch<NotificationRecord[]>('/api/notifications/history?limit=50')
      .then(all => { paceHistory.value = all.filter(n => n.type === 'pace') })
      .catch(() => {}),
  ])
  isLoading.value = false
})

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday = now.toDateString() === date.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = tomorrow.toDateString() === date.toDateString()

  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (isToday) return `today at ${timePart}`
  if (isTomorrow) return `tomorrow at ${timePart}`
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${timePart}`
}

function formatTimeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'now'
  const hours = ms / 3_600_000
  if (hours < 1) return `${Math.round(hours * 60)}min`
  if (hours < 24) return `${hours.toFixed(1)}h`
  const days = hours / 24
  return `${days.toFixed(1)}d`
}

function statusColor(status: PaceWindowInfo['status']): string {
  if (status === 'critical') return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
  if (status === 'warning') return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
  if (status === 'on-track') return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
  return ''
}

function statusBadgeColor(status: PaceWindowInfo['status']): 'error' | 'warning' | 'success' | 'neutral' {
  if (status === 'critical') return 'error'
  if (status === 'warning') return 'warning'
  if (status === 'on-track') return 'success'
  return 'neutral'
}

function statusLabel(status: PaceWindowInfo['status']): string {
  if (status === 'critical') return t('notifications.paceCritical')
  if (status === 'warning') return t('notifications.paceWarning')
  if (status === 'on-track') return t('usage.paceOnTrack')
  return t('usage.paceOnTrack')
}

function formatHistoryTime(createdAt: string): string {
  const date = new Date(createdAt)
  const isToday = new Date().toDateString() === date.toDateString()
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (isToday) return timePart
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + timePart
}

const sortedLevels = computed(() => [...store.settings.paceAlerts.levels].sort((a, b) => a - b))
const customLevels = computed(() => sortedLevels.value.filter(l => !presetLevels.includes(l)))

async function handleTogglePaceEnabled(value: boolean) {
  await store.updateSettings({ paceAlerts: { enabled: value } })
}

async function handleToggleWindow(key: NotificationWindowType, value: boolean) {
  await store.updateSettings({
    paceAlerts: { windows: { ...store.settings.paceAlerts.windows, [key]: value } },
  })
}

async function toggleLevel(level: number) {
  const current = store.settings.paceAlerts.levels
  const levels = current.includes(level)
    ? current.filter(l => l !== level)
    : [...current, level].sort((a, b) => a - b)
  await store.updateSettings({ paceAlerts: { levels } })
}

async function handleRemoveLevel(level: number) {
  const levels = store.settings.paceAlerts.levels.filter(l => l !== level)
  await store.updateSettings({ paceAlerts: { levels } })
}

async function handleAddCustomLevel() {
  const value = Number(customLevelInput.value)
  if (!Number.isInteger(value) || value < 1 || value > 100) return
  if (store.settings.paceAlerts.levels.includes(value)) {
    customLevelInput.value = ''
    return
  }
  const levels = [...store.settings.paceAlerts.levels, value].sort((a, b) => a - b)
  await store.updateSettings({ paceAlerts: { levels } })
  customLevelInput.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl">
    <div>
      <h3 class="text-base font-medium">{{ t('notifications.paceAlerts') }}</h3>
      <p class="text-sm text-muted">{{ t('notifications.paceAlertsDesc') }}</p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-6">
      <UIcon name="i-lucide-loader" class="size-5 animate-spin text-muted" />
    </div>

    <!-- Window cards -->
    <div v-else-if="windows.length > 0" class="flex flex-col gap-3">
      <div
        v-for="win in windows"
        :key="win.key"
        class="flex flex-col gap-3 rounded-lg border p-4"
        :class="statusColor(win.status)"
      >
        <!-- Header: label + status badge -->
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ win.label }}</span>
          <UBadge :color="statusBadgeColor(win.status)" variant="subtle">
            {{ statusLabel(win.status) }}
          </UBadge>
        </div>

        <!-- Utilization bar -->
        <div v-if="win.utilization !== null" class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">{{ t('notifications.paceCurrentUsage') }}</span>
            <span class="font-medium">{{ Math.round(win.utilization) }}%</span>
          </div>
          <UProgress
            :model-value="win.utilization"
            :max="100"
            size="sm"
            :color="win.utilization >= 80 ? 'error' : win.utilization >= 50 ? 'warning' : 'primary'"
          />
        </div>

        <!-- Key metrics -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <template v-if="win.ratePerHour !== null && win.ratePerHour > 0">
            <span class="text-muted">{{ t('notifications.paceRate') }}</span>
            <span class="font-medium text-end">{{ win.ratePerHour.toFixed(1) }}% / hr</span>
          </template>

          <template v-if="win.resetsAt">
            <span class="text-muted">{{ t('notifications.paceResetsIn') }}</span>
            <span class="text-end">{{ formatTimeUntil(win.resetsAt) }} ({{ formatDateTime(win.resetsAt) }})</span>
          </template>

          <template v-if="win.willExhaust && win.exhaustsAt">
            <span class="text-muted font-medium" :class="win.status === 'critical' ? 'text-red-600' : 'text-yellow-600'">
              {{ t('notifications.paceExhaustsAt') }}
            </span>
            <span class="font-medium text-end" :class="win.status === 'critical' ? 'text-red-600' : 'text-yellow-600'">
              {{ formatDateTime(win.exhaustsAt) }}
            </span>
          </template>

        </div>

        <!-- Verdict -->
        <p v-if="win.status === 'on-track' && win.resetsAt" class="text-sm text-green-600 dark:text-green-400">
          {{ t('notifications.paceOnTrackDetail') }}
        </p>
        <p v-else-if="win.willExhaust && win.exhaustsAt" class="text-sm" :class="win.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'">
          {{ t('notifications.paceExhaustDetail', { time: formatDateTime(win.exhaustsAt) }) }}
        </p>
      </div>
    </div>

    <div v-else class="rounded-lg border border-dashed p-4 text-center">
      <p class="text-sm text-muted">{{ t('notifications.paceNoData') }}</p>
    </div>

    <USeparator />

    <!-- Alert toggle -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-base">{{ t('notifications.paceEnabled') }}</p>
        <p class="text-sm text-muted">{{ t('notifications.paceEnabledHint') }}</p>
      </div>
      <USwitch
        :model-value="store.settings.paceAlerts.enabled"
        @update:model-value="handleTogglePaceEnabled"
      />
    </div>

    <!-- Pace alert configuration -->
    <template v-if="store.settings.paceAlerts.enabled">
      <!-- Projected usage levels -->
      <div class="flex flex-col gap-3">
        <div>
          <p class="text-base font-medium">{{ t('notifications.paceProjectedLevels') }}</p>
          <p class="text-sm text-muted">{{ t('notifications.paceProjectedLevelsDesc') }}</p>
        </div>

        <div>
          <p class="text-sm text-muted mb-1.5">{{ t('notifications.presets') }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              v-for="level in presetLevels"
              :key="level"
              :variant="store.settings.paceAlerts.levels.includes(level) ? 'solid' : 'outline'"
              class="cursor-pointer select-none"
              @click="toggleLevel(level)"
            >
              {{ level }}%
            </UBadge>
          </div>
        </div>

        <div>
          <p class="text-sm text-muted mb-1.5">{{ t('notifications.custom') }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              v-for="level in customLevels"
              :key="'custom-' + level"
              variant="solid"
              class="cursor-pointer select-none"
              @click="handleRemoveLevel(level)"
            >
              {{ level }}%
              <UIcon name="i-lucide-x" class="ms-0.5 size-3" />
            </UBadge>
            <div class="flex items-center gap-1">
              <UInput
                v-model="customLevelInput"
                type="number"
                :min="1"
                :max="100"
                :placeholder="t('notifications.customPlaceholder')"
                class="w-20"
                size="xs"
                @keyup.enter="handleAddCustomLevel"
              />
              <UButton
                icon="i-lucide-plus"
                variant="ghost"
                size="xs"
                @click="handleAddCustomLevel"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Per-window toggles -->
      <div class="flex flex-col gap-3">
        <div>
          <p class="text-base font-medium">{{ t('notifications.paceWindows') }}</p>
          <p class="text-sm text-muted">{{ t('notifications.paceWindowsDesc') }}</p>
        </div>

        <div v-for="win in windowConfigs" :key="win.key" class="flex items-center justify-between">
          <p class="text-base">{{ win.label }}</p>
          <USwitch
            :model-value="store.settings.paceAlerts.windows[win.key]"
            @update:model-value="handleToggleWindow(win.key, $event)"
          />
        </div>
      </div>
    </template>

    <!-- Pace alert history -->
    <template v-if="paceHistory.length > 0">
      <USeparator />
      <div class="flex flex-col gap-3">
        <h4 class="text-sm font-medium text-muted">{{ t('notifications.paceHistory') }}</h4>
        <div class="flex flex-col gap-2">
          <div
            v-for="item in paceHistory"
            :key="item.id"
            class="flex items-start justify-between gap-4 rounded-lg border p-3"
          >
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-trending-up" class="mt-0.5 size-4 text-yellow-500" />
              <div>
                <p class="text-base">{{ item.title }}</p>
                <p class="text-sm text-muted">{{ item.body }}</p>
              </div>
            </div>
            <span class="shrink-0 text-sm text-muted">{{ formatHistoryTime(item.createdAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
