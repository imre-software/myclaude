<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { WhatsAppEvent } from '~/types/whatsapp'

const { t } = useI18n()
const toast = useToast()
const store = useNotificationStore()

const props = withDefaults(defineProps<{
  mode?: 'connect' | 'reconnect'
}>(), { mode: 'connect' })

const isOpen = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  complete: []
  cancel: []
}>()

const phoneNumber = ref('')
const isPhoneValid = ref(false)
const phoneDirty = ref(false)

const qrDataUrl = ref('')
const qrStatus = ref<'waiting' | 'connecting' | 'connected' | 'error'>('waiting')
const errorMessage = ref('')
let eventSource: EventSource | null = null

const isTestSending = ref(false)

const STEP_PHONE = 0
const STEP_QR = 1
const STEP_SUCCESS = 2

const activeStep = ref(STEP_PHONE)

const stepItems = computed<StepperItem[]>(() => [
  {
    title: t('whatsapp.wizardPhoneTitle'),
    description: t('whatsapp.wizardPhoneDesc'),
    icon: 'i-lucide-phone',
    value: STEP_PHONE,
    slot: 'phone',
  },
  {
    title: t('whatsapp.wizardQrTitle'),
    description: t('whatsapp.wizardQrDesc'),
    icon: 'i-lucide-qr-code',
    value: STEP_QR,
    slot: 'qr',
  },
  {
    title: t('whatsapp.wizardSuccessTitle'),
    description: t('whatsapp.wizardSuccessDesc'),
    icon: 'i-lucide-check',
    value: STEP_SUCCESS,
    slot: 'success',
  },
])

function handlePhoneInput() {
  phoneDirty.value = true
}

async function handleNextToQr() {
  if (!isPhoneValid.value) return
  activeStep.value = STEP_QR
  await startConnection()
}

async function startConnection() {
  qrStatus.value = 'waiting'
  qrDataUrl.value = ''
  errorMessage.value = ''

  try {
    await $fetch('/api/whatsapp/connect', {
      method: 'POST',
      body: { phoneNumber: phoneNumber.value },
    })
  } catch {
    qrStatus.value = 'error'
    errorMessage.value = t('whatsapp.errorConnectionFailed')
    return
  }

  openEventStream()
}

function openEventStream() {
  closeEventStream()

  eventSource = new EventSource('/api/whatsapp/qr-stream')

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WhatsAppEvent

      if (data.type === 'qr') {
        qrDataUrl.value = data.qr
        qrStatus.value = 'waiting'
      } else if (data.type === 'connected') {
        qrStatus.value = 'connected'
        closeEventStream()
        store.loadWhatsAppStatus()
        activeStep.value = STEP_SUCCESS
      } else if (data.type === 'status' && data.connection === 'connecting') {
        qrStatus.value = 'connecting'
      } else if (data.type === 'error') {
        qrStatus.value = 'error'
        errorMessage.value = data.message
      }
    } catch {
      // Malformed event
    }
  }

  eventSource.onerror = () => {
    // SSE will auto-reconnect
  }
}

function closeEventStream() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

async function handleTestMessage() {
  isTestSending.value = true
  try {
    const result = await $fetch<{ ok: boolean, queued?: boolean }>('/api/whatsapp/test', { method: 'POST' })
    if (result.ok) {
      toast.add({ title: t('whatsapp.testSent'), color: 'success' })
    } else {
      toast.add({ title: t('whatsapp.testQueued'), color: 'warning' })
    }
  } catch {
    toast.add({ title: t('whatsapp.testFailed'), color: 'error' })
  } finally {
    isTestSending.value = false
  }
}

function handleDone() {
  closeEventStream()
  isOpen.value = false
  emit('complete')
}

function handleCancel() {
  closeEventStream()
  isOpen.value = false
  emit('cancel')
}

watch(isOpen, (open) => {
  if (!open) {
    closeEventStream()
    return
  }

  if (props.mode === 'reconnect') {
    phoneNumber.value = store.whatsappStatus.phoneNumber || store.settings.whatsapp.phoneNumber
    activeStep.value = STEP_QR
    startConnection()
  } else {
    activeStep.value = STEP_PHONE
  }
})

onUnmounted(() => {
  closeEventStream()
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('whatsapp.title')"
    :dismissible="false"
  >
    <template #default />

    <template #body>
      <UStepper
        v-model="activeStep"
        :items="stepItems"
        orientation="horizontal"
        disabled
        class="w-full"
      >
        <template #phone>
          <div class="flex flex-col gap-4 py-4">
            <UFormField
              :label="t('whatsapp.recipientNumber')"
              :error="phoneDirty && !isPhoneValid ? 'Enter a valid phone number' : undefined"
            >
              <PhoneInput
                v-model="phoneNumber"
                v-model:valid="isPhoneValid"
                size="md"
                required
                @input="handlePhoneInput"
              />
            </UFormField>

            <UAlert
              :title="t('whatsapp.wizardPhoneInfo')"
              icon="i-lucide-info"
              color="info"
              variant="soft"
            />

            <div class="flex justify-end gap-2">
              <UButton
                variant="ghost"
                color="neutral"
                @click="handleCancel"
              >
                {{ t('whatsapp.wizardCancel') }}
              </UButton>
              <UButton
                :disabled="!isPhoneValid"
                @click="handleNextToQr"
              >
                {{ t('whatsapp.wizardNext') }}
              </UButton>
            </div>
          </div>
        </template>

        <template #qr>
          <div class="flex flex-col items-center gap-4 py-4">
            <div v-if="qrDataUrl" class="rounded-xl border border-default bg-white p-4 dark:bg-white">
              <img
                :src="qrDataUrl"
                :alt="t('whatsapp.wizardQrTitle')"
                class="size-64"
              >
            </div>
            <div v-else-if="qrStatus === 'error'" class="flex flex-col items-center gap-2">
              <UIcon name="i-lucide-alert-circle" class="size-10 text-red-500" />
              <p class="text-base text-red-600">{{ errorMessage }}</p>
            </div>
            <div v-else class="flex size-64 items-center justify-center">
              <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
            </div>

            <p class="text-sm text-muted text-center max-w-sm">
              {{ t('whatsapp.wizardQrInstruction') }}
            </p>

            <p class="text-base font-medium">
              {{ qrStatus === 'connecting' ? t('whatsapp.statusConnecting') : t('whatsapp.wizardQrWaiting') }}
            </p>

            <div class="flex justify-end gap-2 w-full">
              <UButton
                variant="ghost"
                color="neutral"
                @click="handleCancel"
              >
                {{ t('whatsapp.wizardCancel') }}
              </UButton>
            </div>
          </div>
        </template>

        <template #success>
          <div class="flex flex-col items-center gap-4 py-4">
            <div class="flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <UIcon name="i-lucide-check" class="size-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div class="text-center">
              <p class="text-lg font-semibold">{{ t('whatsapp.wizardSuccessTitle') }}</p>
              <p class="text-sm text-muted">{{ t('whatsapp.wizardSuccessTest') }}</p>
            </div>

            <div class="flex gap-2">
              <UButton
                variant="outline"
                icon="i-lucide-send"
                :loading="isTestSending"
                @click="handleTestMessage"
              >
                {{ t('whatsapp.testButton') }}
              </UButton>
              <UButton @click="handleDone">
                {{ t('whatsapp.wizardDone') }}
              </UButton>
            </div>
          </div>
        </template>
      </UStepper>
    </template>
  </UModal>
</template>
