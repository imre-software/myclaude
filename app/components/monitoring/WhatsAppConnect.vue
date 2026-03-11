<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const store = useNotificationStore()

const isWizardOpen = ref(false)
const wizardMode = ref<'connect' | 'reconnect'>('connect')
const isTestSending = ref(false)

const isConnected = computed(() => store.whatsappStatus.connection === 'connected')
const isDisconnected = computed(() => ['disconnected', 'logged-out'].includes(store.whatsappStatus.connection))

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    'disconnected': t('whatsapp.statusDisconnected'),
    'connecting': t('whatsapp.statusConnecting'),
    'qr-ready': t('whatsapp.statusQrReady'),
    'connected': t('whatsapp.statusConnected'),
    'logged-out': t('whatsapp.statusLoggedOut'),
  }
  return map[store.whatsappStatus.connection] ?? store.whatsappStatus.connection
})

const statusColor = computed(() => {
  if (isConnected.value) return 'bg-emerald-500'
  if (store.whatsappStatus.connection === 'connecting') return 'bg-yellow-500'
  return 'bg-gray-400'
})

function handleConnect() {
  wizardMode.value = 'connect'
  isWizardOpen.value = true
}

function handleReconnect() {
  wizardMode.value = 'reconnect'
  isWizardOpen.value = true
}

async function handleWizardComplete() {
  await store.loadWhatsAppStatus()
  // Refresh settings so the toggle reflects the new state
  store.settings = await $fetch('/api/notifications/settings')
}

async function handleToggleEnabled(value: boolean) {
  await store.updateSettings({ whatsapp: { enabled: value } })
}

async function handleTestMessage() {
  isTestSending.value = true
  try {
    const result = await $fetch<{ ok: boolean, queued?: boolean }>('/api/whatsapp/test', { method: 'POST' })
    if (result.ok) {
      toast.add({ title: t('whatsapp.testSent'), color: 'success' })
    } else if (result.queued) {
      toast.add({ title: t('whatsapp.testQueued'), color: 'warning' })
    }
  } catch {
    toast.add({ title: t('whatsapp.testFailed'), color: 'error' })
  } finally {
    isTestSending.value = false
  }
}

async function handleDisconnect() {
  await $fetch('/api/whatsapp/disconnect', { method: 'POST' })
  await store.loadWhatsAppStatus()
}

async function handleLogout() {
  await $fetch('/api/whatsapp/logout', { method: 'POST' })
  await store.loadWhatsAppStatus()
  // Refresh settings since logout clears whatsapp config
  store.settings = await $fetch('/api/notifications/settings')
}

onMounted(() => {
  store.loadWhatsAppStatus()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-xl">
    <div>
      <h3 class="text-base font-medium">{{ t('whatsapp.title') }}</h3>
      <p class="text-sm text-muted">{{ t('whatsapp.description') }}</p>
    </div>

    <!-- Status indicator -->
    <div class="flex items-center gap-3">
      <span class="relative flex size-3">
        <span
          v-if="isConnected"
          class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"
        />
        <span class="relative inline-flex size-3 rounded-full" :class="statusColor" />
      </span>
      <p class="text-base font-medium">{{ statusLabel }}</p>
    </div>

    <!-- Not connected state -->
    <template v-if="isDisconnected">
      <UButton
        icon="i-lucide-message-circle"
        size="lg"
        @click="handleConnect"
      >
        {{ t('whatsapp.connectButton') }}
      </UButton>
    </template>

    <!-- Connected state -->
    <template v-if="isConnected">
      <!-- Phone number display -->
      <div v-if="store.whatsappStatus.phoneNumber" class="flex items-center gap-2">
        <UIcon name="i-lucide-phone" class="size-4 text-muted" />
        <p class="text-base">{{ store.whatsappStatus.phoneNumber }}</p>
      </div>

      <!-- Enable toggle -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-base">{{ t('whatsapp.enableNotifications') }}</p>
          <p class="text-sm text-muted">{{ t('whatsapp.enableNotificationsDesc') }}</p>
        </div>
        <USwitch
          :model-value="store.settings.whatsapp.enabled"
          @update:model-value="handleToggleEnabled"
        />
      </div>

      <!-- Test message -->
      <div>
        <UButton
          icon="i-lucide-send"
          variant="outline"
          :loading="isTestSending"
          @click="handleTestMessage"
        >
          {{ t('whatsapp.testButton') }}
        </UButton>
      </div>

      <!-- Queue stats -->
      <div v-if="store.whatsappStatus.queueStats.pending > 0 || store.whatsappStatus.queueStats.failed > 0" class="flex flex-col gap-1">
        <p v-if="store.whatsappStatus.queueStats.pending > 0" class="text-sm text-muted">
          {{ t('whatsapp.queuePending', store.whatsappStatus.queueStats.pending) }}
        </p>
        <p v-if="store.whatsappStatus.queueStats.failed > 0" class="text-sm text-yellow-600 dark:text-yellow-400">
          {{ t('whatsapp.queueFailed', store.whatsappStatus.queueStats.failed) }}
        </p>
      </div>

      <!-- Session management -->
      <div class="border-t border-gray-200 pt-4 dark:border-gray-800">
        <p class="text-sm text-muted mb-3">{{ t('whatsapp.sessionSectionDesc') }}</p>
        <div class="flex gap-2">
          <UButton
            variant="outline"
            color="neutral"
            @click="handleDisconnect"
          >
            {{ t('whatsapp.disconnectButton') }}
          </UButton>
          <UButton
            variant="ghost"
            color="error"
            @click="handleLogout"
          >
            {{ t('whatsapp.logoutButton') }}
          </UButton>
        </div>
      </div>
    </template>

    <!-- Connecting / QR state - show reconnect button -->
    <template v-if="!isConnected && !isDisconnected">
      <UButton
        variant="outline"
        icon="i-lucide-refresh-cw"
        @click="handleReconnect"
      >
        {{ t('whatsapp.reconnectButton') }}
      </UButton>
    </template>

    <!-- Wizard modal -->
    <MonitoringWhatsAppWizard
      v-model:open="isWizardOpen"
      :mode="wizardMode"
      @complete="handleWizardComplete"
    />
  </div>
</template>
