<script setup lang="ts">
import type { TelegramBotInfo } from '~/types/telegram'

const { t } = useI18n()
const toast = useToast()
const store = useNotificationStore()

const isSetupOpen = ref(false)
const isTestSending = ref(false)

// Setup wizard state
const step = ref<'token' | 'chat-id' | 'done'>('token')
const botToken = ref('')
const chatId = ref('')
const detectedName = ref('')
const botInfo = ref<TelegramBotInfo | null>(null)
const isValidating = ref(false)
const isSaving = ref(false)
const isDetecting = ref(false)
const validationError = ref('')
const detectError = ref('')
let detectInterval: ReturnType<typeof setInterval> | null = null

const isConnected = computed(() => store.telegramStatus.connected)

function handleSetup() {
  step.value = 'token'
  botToken.value = ''
  chatId.value = ''
  detectedName.value = ''
  botInfo.value = null
  validationError.value = ''
  detectError.value = ''
  isSetupOpen.value = true
}

function stopDetecting() {
  if (detectInterval) {
    clearInterval(detectInterval)
    detectInterval = null
  }
  isDetecting.value = false
}

async function handleValidateToken() {
  isValidating.value = true
  validationError.value = ''
  try {
    const res = await $fetch<{ ok: boolean, bot: TelegramBotInfo }>('/api/telegram/validate-token', {
      method: 'POST',
      body: { token: botToken.value.trim() },
    })
    botInfo.value = res.bot
    step.value = 'chat-id'
    startDetecting()
  } catch {
    validationError.value = t('telegram.invalidToken')
  } finally {
    isValidating.value = false
  }
}

async function detectChat() {
  try {
    const res = await $fetch<{ found: boolean, chatId?: string, name?: string }>('/api/telegram/detect-chat', {
      method: 'POST',
      body: { token: botToken.value.trim() },
    })
    if (res.found && res.chatId) {
      chatId.value = res.chatId
      detectedName.value = res.name || ''
      stopDetecting()
    }
  } catch {
    // Keep polling
  }
}

function startDetecting() {
  isDetecting.value = true
  detectError.value = ''
  chatId.value = ''
  detectedName.value = ''
  detectChat()
  detectInterval = setInterval(detectChat, 3000)
}

async function handleSave() {
  isSaving.value = true
  try {
    await $fetch('/api/telegram/setup', {
      method: 'POST',
      body: {
        botToken: botToken.value.trim(),
        chatId: chatId.value.trim(),
        botName: botInfo.value?.username || '',
      },
    })
    step.value = 'done'
    await store.loadTelegramStatus()
    store.settings = await $fetch('/api/notifications/settings')
  } catch {
    toast.add({ title: t('telegram.setupFailed'), color: 'error' })
  } finally {
    isSaving.value = false
  }
}

async function handleToggleEnabled(value: boolean) {
  await store.updateSettings({ telegram: { enabled: value } })
}

async function handleTestMessage() {
  isTestSending.value = true
  try {
    const result = await $fetch<{ ok: boolean }>('/api/telegram/test', { method: 'POST' })
    if (result.ok) {
      toast.add({ title: t('telegram.testSent'), color: 'success' })
    } else {
      toast.add({ title: t('telegram.testFailed'), color: 'error' })
    }
  } catch {
    toast.add({ title: t('telegram.testFailed'), color: 'error' })
  } finally {
    isTestSending.value = false
  }
}

async function handleDisconnect() {
  await $fetch('/api/telegram/disconnect', { method: 'POST' })
  await store.loadTelegramStatus()
  store.settings = await $fetch('/api/notifications/settings')
}

function handleModalClose() {
  stopDetecting()
}

watch(isSetupOpen, (open) => {
  if (!open) handleModalClose()
})

onMounted(() => {
  store.loadTelegramStatus()
})

onUnmounted(() => {
  stopDetecting()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-xl">
    <div>
      <h3 class="text-base font-medium">{{ t('telegram.title') }}</h3>
      <p class="text-sm text-muted">{{ t('telegram.description') }}</p>
    </div>

    <!-- Status indicator -->
    <div class="flex items-center gap-3">
      <span class="relative flex size-3">
        <span
          v-if="isConnected"
          class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"
        />
        <span
          class="relative inline-flex size-3 rounded-full"
          :class="isConnected ? 'bg-emerald-500' : 'bg-gray-400'"
        />
      </span>
      <p class="text-base font-medium">
        {{ isConnected ? t('telegram.statusConnected') : t('telegram.statusDisconnected') }}
      </p>
    </div>

    <!-- Not connected state -->
    <template v-if="!isConnected">
      <UButton
        icon="i-lucide-send"
        size="lg"
        @click="handleSetup"
      >
        {{ t('telegram.setupButton') }}
      </UButton>
    </template>

    <!-- Connected state -->
    <template v-if="isConnected">
      <!-- Bot name display -->
      <div v-if="store.telegramStatus.botName" class="flex items-center gap-2">
        <UIcon name="i-lucide-bot" class="size-4 text-muted" />
        <p class="text-base">@{{ store.telegramStatus.botName }}</p>
      </div>

      <!-- Chat ID display -->
      <div v-if="store.telegramStatus.chatId" class="flex items-center gap-2">
        <UIcon name="i-lucide-message-circle" class="size-4 text-muted" />
        <p class="text-base">{{ t('telegram.chatIdLabel') }}: {{ store.telegramStatus.chatId }}</p>
      </div>

      <!-- Enable toggle -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-base">{{ t('telegram.enableNotifications') }}</p>
          <p class="text-sm text-muted">{{ t('telegram.enableNotificationsDesc') }}</p>
        </div>
        <USwitch
          :model-value="store.settings.telegram.enabled"
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
          {{ t('telegram.testButton') }}
        </UButton>
      </div>

      <!-- Disconnect -->
      <div class="border-t border-gray-200 pt-4 dark:border-gray-800">
        <p class="text-sm text-muted mb-3">{{ t('telegram.disconnectDesc') }}</p>
        <UButton
          variant="ghost"
          color="error"
          @click="handleDisconnect"
        >
          {{ t('telegram.disconnectButton') }}
        </UButton>
      </div>
    </template>

    <!-- Setup modal -->
    <UModal v-model:open="isSetupOpen">
      <template #content>
        <div class="p-6 flex flex-col gap-6">
          <!-- Step 1: Bot token -->
          <template v-if="step === 'token'">
            <div>
              <h3 class="text-lg font-semibold">{{ t('telegram.wizardTokenTitle') }}</h3>
              <p class="text-sm text-muted mt-1">{{ t('telegram.wizardTokenDesc') }}</p>
            </div>

            <UFormField :label="t('telegram.botTokenLabel')">
              <UInput
                v-model="botToken"
                :placeholder="t('telegram.botTokenPlaceholder')"
                class="w-full"
                @keydown.enter="handleValidateToken"
              />
            </UFormField>

            <p v-if="validationError" class="text-sm text-red-500">{{ validationError }}</p>

            <p class="text-sm text-muted">{{ t('telegram.wizardTokenInfo') }}</p>

            <div class="flex justify-end gap-2">
              <UButton
                variant="outline"
                color="neutral"
                @click="isSetupOpen = false"
              >
                {{ t('telegram.wizardCancel') }}
              </UButton>
              <UButton
                :loading="isValidating"
                :disabled="!botToken.trim()"
                @click="handleValidateToken"
              >
                {{ t('telegram.wizardNext') }}
              </UButton>
            </div>
          </template>

          <!-- Step 2: Chat ID (auto-detect) -->
          <template v-if="step === 'chat-id'">
            <div>
              <h3 class="text-lg font-semibold">{{ t('telegram.wizardChatIdTitle') }}</h3>
              <p class="text-sm text-muted mt-1">{{ t('telegram.wizardChatIdAutoDesc', { botName: botInfo?.username || '' }) }}</p>
            </div>

            <!-- Waiting for message -->
            <div v-if="!chatId" class="flex flex-col items-center gap-4 py-4">
              <div class="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <UIcon name="i-lucide-message-circle" class="size-5 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <p class="text-base text-center">{{ t('telegram.wizardWaitingForMessage') }}</p>
              <p class="text-sm text-muted text-center">{{ t('telegram.wizardWaitingHint', { botName: botInfo?.username || '' }) }}</p>
            </div>

            <!-- Chat detected -->
            <div v-if="chatId" class="flex flex-col items-center gap-3 py-4">
              <div class="flex size-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <UIcon name="i-lucide-check" class="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p class="text-base font-medium">{{ t('telegram.wizardChatDetected') }}</p>
              <p v-if="detectedName" class="text-sm text-muted">{{ detectedName }}</p>
            </div>

            <p v-if="detectError" class="text-sm text-red-500">{{ detectError }}</p>

            <div class="flex justify-end gap-2">
              <UButton
                variant="outline"
                color="neutral"
                @click="stopDetecting(); step = 'token'"
              >
                {{ t('telegram.wizardBack') }}
              </UButton>
              <UButton
                :loading="isSaving"
                :disabled="!chatId"
                @click="handleSave"
              >
                {{ t('telegram.wizardSave') }}
              </UButton>
            </div>
          </template>

          <!-- Step 3: Done -->
          <template v-if="step === 'done'">
            <div class="flex flex-col items-center gap-4 py-4">
              <div class="flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <UIcon name="i-lucide-check" class="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 class="text-lg font-semibold">{{ t('telegram.wizardSuccessTitle') }}</h3>
              <p class="text-sm text-muted text-center">{{ t('telegram.wizardSuccessDesc') }}</p>
            </div>

            <div class="flex justify-end">
              <UButton @click="isSetupOpen = false">
                {{ t('telegram.wizardDone') }}
              </UButton>
            </div>
          </template>
        </div>
      </template>
    </UModal>
  </div>
</template>
