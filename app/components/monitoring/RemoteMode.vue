<script setup lang="ts">
import type { RemoteLogEntry } from '~/types/remote'

const { t } = useI18n()
const toast = useToast()
const store = useNotificationStore()

const isEnabling = ref(false)
const isDisabling = ref(false)
const isCancelling = ref(false)
const history = ref<RemoteLogEntry[]>([])

interface RemoteStatus {
  enabled: boolean
  hooks: { stop: boolean, permissionRequest: boolean, notification: boolean }
  channels: { whatsapp: boolean, telegram: boolean }
  timeoutMinutes: number
  hooksInstalled: boolean
  telegramPolling: boolean
  pending: { sessionId: string, hookEvent: string, elapsedMs: number } | null
}

const status = ref<RemoteStatus>({
  enabled: false,
  hooks: { stop: true, permissionRequest: true, notification: true },
  channels: { whatsapp: false, telegram: false },
  timeoutMinutes: 60,
  hooksInstalled: false,
  telegramPolling: false,
  pending: null,
})

let pollInterval: ReturnType<typeof setInterval> | null = null

const isWhatsAppConnected = computed(() => store.whatsappStatus.connection === 'connected')
const isTelegramConnected = computed(() => store.telegramStatus.connected)
const hasAnyChannel = computed(() => isWhatsAppConnected.value || isTelegramConnected.value)

const pendingElapsed = computed(() => {
  if (!status.value.pending) return ''
  const mins = Math.floor(status.value.pending.elapsedMs / 60_000)
  if (mins < 1) return 'just now'
  return `${mins} min ago`
})

async function loadStatus() {
  try {
    status.value = await $fetch<RemoteStatus>('/api/remote/status')
  } catch {
    // Ignore
  }
}

async function loadHistory() {
  try {
    history.value = await $fetch<RemoteLogEntry[]>('/api/remote/history', {
      params: { limit: 20 },
    })
  } catch {
    // Ignore
  }
}

async function handleEnable() {
  isEnabling.value = true
  try {
    await $fetch('/api/remote/enable', { method: 'POST' })
    await loadStatus()
    toast.add({ title: t('remote.enabledToast'), color: 'success' })
  } catch {
    toast.add({ title: t('remote.enableFailed'), color: 'error' })
  } finally {
    isEnabling.value = false
  }
}

async function handleDisable() {
  isDisabling.value = true
  try {
    await $fetch('/api/remote/disable', { method: 'POST' })
    await loadStatus()
    toast.add({ title: t('remote.disabledToast'), color: 'success' })
  } catch {
    toast.add({ title: t('remote.disableFailed'), color: 'error' })
  } finally {
    isDisabling.value = false
  }
}

async function handleToggleHook(hook: 'stop' | 'permissionRequest' | 'notification', value: boolean) {
  await $fetch('/api/remote/settings', {
    method: 'PUT',
    body: { hooks: { [hook]: value } },
  })
  await loadStatus()
}

async function handleToggleChannel(channel: 'whatsapp' | 'telegram', value: boolean) {
  await $fetch('/api/remote/settings', {
    method: 'PUT',
    body: { channels: { [channel]: value } },
  })
  await loadStatus()
}

async function handleTimeoutChange(value: number | undefined) {
  if (value === undefined) return
  await $fetch('/api/remote/settings', {
    method: 'PUT',
    body: { timeoutMinutes: value },
  })
  await loadStatus()
}

async function handleCancel() {
  isCancelling.value = true
  try {
    await $fetch('/api/remote/cancel', { method: 'POST' })
    await loadStatus()
  } catch {
    // Ignore
  } finally {
    isCancelling.value = false
  }
}

function hookEventLabel(event: string): string {
  if (event === 'Stop') return t('remote.hookStop')
  if (event === 'PermissionRequest') return t('remote.hookPermission')
  if (event === 'Notification') return t('remote.hookNotification')
  return event
}

function statusColor(s: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (s === 'replied') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'timeout') return 'error'
  return 'neutral'
}

onMounted(() => {
  loadStatus()
  loadHistory()
  pollInterval = setInterval(loadStatus, 5000)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-xl">
    <div>
      <h3 class="text-base font-medium">{{ t('remote.title') }}</h3>
      <p class="text-sm text-muted">{{ t('remote.description') }}</p>
    </div>

    <!-- Status indicator -->
    <div class="flex items-center gap-3">
      <span class="relative flex size-3">
        <span
          v-if="status.enabled"
          class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"
        />
        <span
          class="relative inline-flex size-3 rounded-full"
          :class="status.enabled ? 'bg-emerald-500' : 'bg-gray-400'"
        />
      </span>
      <p class="text-base font-medium">
        {{ status.enabled ? t('remote.statusEnabled') : t('remote.statusDisabled') }}
      </p>
      <UBadge v-if="status.hooksInstalled && status.enabled" color="success" variant="subtle" size="sm">
        {{ t('remote.hooksInstalled') }}
      </UBadge>
    </div>

    <!-- No channels warning -->
    <div v-if="!hasAnyChannel" class="rounded-lg bg-amber-50 p-4 dark:bg-amber-950/30">
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-alert-triangle" class="size-5 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div>
          <p class="text-base font-medium text-amber-800 dark:text-amber-200">{{ t('remote.noChannels') }}</p>
          <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">{{ t('remote.noChannelsDesc') }}</p>
        </div>
      </div>
    </div>

    <!-- Enable / Disable -->
    <div>
      <UButton
        v-if="!status.enabled"
        icon="i-lucide-smartphone"
        size="lg"
        :loading="isEnabling"
        :disabled="!hasAnyChannel"
        @click="handleEnable"
      >
        {{ t('remote.enableButton') }}
      </UButton>
      <UButton
        v-else
        icon="i-lucide-power-off"
        variant="outline"
        color="error"
        :loading="isDisabling"
        @click="handleDisable"
      >
        {{ t('remote.disableButton') }}
      </UButton>
    </div>

    <!-- Pending request display -->
    <div v-if="status.pending" class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-loader" class="size-5 text-blue-600 dark:text-blue-400 mt-0.5 animate-spin" />
          <div>
            <p class="text-base font-medium text-blue-800 dark:text-blue-200">{{ t('remote.pendingTitle') }}</p>
            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {{ hookEventLabel(status.pending.hookEvent) }} - {{ pendingElapsed }}
            </p>
          </div>
        </div>
        <UButton
          variant="ghost"
          color="error"
          size="sm"
          :loading="isCancelling"
          @click="handleCancel"
        >
          {{ t('remote.cancelPending') }}
        </UButton>
      </div>
    </div>

    <!-- Settings (only when enabled) -->
    <template v-if="status.enabled">
      <!-- Hook toggles -->
      <div class="flex flex-col gap-4">
        <h4 class="text-base font-medium">{{ t('remote.hooksSection') }}</h4>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-base">{{ t('remote.hookStop') }}</p>
            <p class="text-sm text-muted">{{ t('remote.hookStopDesc') }}</p>
          </div>
          <USwitch
            :model-value="status.hooks.stop"
            @update:model-value="handleToggleHook('stop', $event)"
          />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-base">{{ t('remote.hookPermission') }}</p>
            <p class="text-sm text-muted">{{ t('remote.hookPermissionDesc') }}</p>
          </div>
          <USwitch
            :model-value="status.hooks.permissionRequest"
            @update:model-value="handleToggleHook('permissionRequest', $event)"
          />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-base">{{ t('remote.hookNotification') }}</p>
            <p class="text-sm text-muted">{{ t('remote.hookNotificationDesc') }}</p>
          </div>
          <USwitch
            :model-value="status.hooks.notification"
            @update:model-value="handleToggleHook('notification', $event)"
          />
        </div>
      </div>

      <!-- Channel toggles -->
      <div class="flex flex-col gap-4 border-t border-default pt-4">
        <h4 class="text-base font-medium">{{ t('remote.channelsSection') }}</h4>

        <div v-if="isWhatsAppConnected" class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-message-circle" class="size-4 text-muted" />
            <p class="text-base">WhatsApp</p>
          </div>
          <USwitch
            :model-value="status.channels.whatsapp"
            @update:model-value="handleToggleChannel('whatsapp', $event)"
          />
        </div>

        <div v-if="isTelegramConnected" class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-send" class="size-4 text-muted" />
            <p class="text-base">Telegram</p>
          </div>
          <USwitch
            :model-value="status.channels.telegram"
            @update:model-value="handleToggleChannel('telegram', $event)"
          />
        </div>
      </div>

      <!-- Timeout setting -->
      <div class="flex flex-col gap-2 border-t border-default pt-4">
        <h4 class="text-base font-medium">{{ t('remote.timeoutSection') }}</h4>
        <p class="text-sm text-muted">{{ t('remote.timeoutDesc') }}</p>
        <div class="flex items-center gap-4">
          <USlider
            :model-value="status.timeoutMinutes"
            :min="15"
            :max="120"
            :step="15"
            class="flex-1"
            @update:model-value="handleTimeoutChange"
          />
          <span class="text-base font-medium w-16 text-end">{{ status.timeoutMinutes }} min</span>
        </div>
      </div>
    </template>

    <!-- History -->
    <div v-if="history.length > 0" class="flex flex-col gap-3 border-t border-default pt-4">
      <h4 class="text-base font-medium">{{ t('remote.historySection') }}</h4>

      <div class="flex flex-col gap-2">
        <div
          v-for="entry in history"
          :key="entry.id"
          class="flex items-center justify-between rounded-lg border border-default p-3"
        >
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="flex items-center gap-2">
              <UBadge :color="statusColor(entry.status)" variant="subtle" size="sm">
                {{ entry.status }}
              </UBadge>
              <span class="text-sm text-muted">{{ hookEventLabel(entry.hookEvent) }}</span>
            </div>
            <p class="text-base truncate">{{ entry.project }}</p>
            <p v-if="entry.userReply" class="text-sm text-muted truncate">{{ entry.userReply }}</p>
          </div>
          <span class="text-sm text-muted whitespace-nowrap ms-3">{{ entry.createdAt }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
