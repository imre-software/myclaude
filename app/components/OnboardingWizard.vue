<script setup lang="ts">
const { t } = useI18n()

const emit = defineEmits<{ complete: [] }>()

interface OnboardingStatus {
  completed: boolean
  claudeInstalled: boolean
  claudeAuthenticated: boolean
  hasSessions: boolean
  subscriptionType: 'max' | 'api' | null
}

const isDev = import.meta.dev

const status = ref<OnboardingStatus | null>(null)
const currentStep = ref(0)
const isChecking = ref(false)
const isSyncing = ref(false)

const steps = computed(() => [
  {
    key: 'welcome',
    title: t('onboarding.welcomeTitle'),
    icon: 'i-lucide-sparkles',
  },
  {
    key: 'cli',
    title: t('onboarding.cliTitle'),
    icon: 'i-lucide-terminal',
    passed: status.value?.claudeInstalled ?? false,
  },
  {
    key: 'auth',
    title: t('onboarding.authTitle'),
    icon: 'i-lucide-key-round',
    passed: status.value?.claudeAuthenticated ?? false,
  },
  {
    key: 'sync',
    title: t('onboarding.syncTitle'),
    icon: 'i-lucide-database',
    passed: status.value?.hasSessions ?? false,
  },
  {
    key: 'done',
    title: t('onboarding.doneTitle'),
    icon: 'i-lucide-check-circle',
  },
])

onMounted(async () => {
  await checkStatus()

  // Auto-advance past completed steps
  if (status.value) {
    if (status.value.claudeInstalled && status.value.claudeAuthenticated && status.value.hasSessions) {
      currentStep.value = 4 // Done
    } else if (status.value.claudeInstalled && status.value.claudeAuthenticated) {
      currentStep.value = 3 // Sync
    } else if (status.value.claudeInstalled) {
      currentStep.value = 2 // Auth
    } else {
      currentStep.value = 1 // CLI
    }
  }
})

async function checkStatus() {
  isChecking.value = true
  try {
    status.value = await $fetch<OnboardingStatus>('/api/onboarding/status')
  } finally {
    isChecking.value = false
  }
}

async function handleRecheck() {
  await checkStatus()
  const s = status.value
  if (!s) return

  // Auto-advance if current step is now satisfied
  if (currentStep.value === 1 && s.claudeInstalled) {
    currentStep.value = s.claudeAuthenticated ? (s.hasSessions ? 4 : 3) : 2
  } else if (currentStep.value === 2 && s.claudeAuthenticated) {
    currentStep.value = s.hasSessions ? 4 : 3
  } else if (currentStep.value === 3 && s.hasSessions) {
    currentStep.value = 4
  }
}

async function handleSync() {
  isSyncing.value = true
  try {
    // Trigger a sync via the stats API
    await $fetch('/api/stats/overview')
    await checkStatus()
    if (status.value?.hasSessions) {
      currentStep.value = 4
    }
  } finally {
    isSyncing.value = false
  }
}

async function handleComplete() {
  await $fetch('/api/onboarding/complete', { method: 'POST' })
  emit('complete')
}

function handleSkip() {
  handleComplete()
}
</script>

<template>
  <div class="flex flex-col items-center gap-8 px-8 py-10">
    <!-- Stepper -->
    <div class="flex items-center gap-2">
      <template v-for="(step, idx) in steps" :key="step.key">
        <div
          class="flex size-8 items-center justify-center rounded-full text-sm transition-colors"
          :class="idx <= currentStep
            ? 'bg-primary text-white'
            : 'bg-elevated text-muted'"
        >
          <UIcon
            v-if="idx < currentStep"
            name="i-lucide-check"
            class="size-4"
          />
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <div
          v-if="idx < steps.length - 1"
          class="h-0.5 w-8 transition-colors"
          :class="idx < currentStep ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'"
        />
      </template>
    </div>

    <!-- Step content -->
    <div class="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <!-- Welcome -->
      <template v-if="currentStep === 0">
        <UIcon name="i-lucide-sparkles" class="size-12 text-primary" />
        <h2 class="text-xl font-bold">{{ t('onboarding.welcomeTitle') }}</h2>
        <p class="text-base text-muted">{{ t('onboarding.welcomeDesc') }}</p>
        <UButton :label="t('onboarding.getStarted')" size="lg" @click="currentStep = 1" />
      </template>

      <!-- CLI Check -->
      <template v-if="currentStep === 1">
        <UIcon name="i-lucide-terminal" class="size-12 text-primary" />
        <h2 class="text-xl font-bold">{{ t('onboarding.cliTitle') }}</h2>
        <div v-if="status?.claudeInstalled" class="flex items-center gap-2 text-green-600">
          <UIcon name="i-lucide-check-circle" class="size-5" />
          <span class="text-base">{{ t('onboarding.cliInstalled') }}</span>
        </div>
        <div v-else class="flex flex-col gap-4">
          <p class="text-base text-muted">{{ t('onboarding.cliNotInstalled') }}</p>
          <div class="rounded-lg bg-elevated px-4 py-3 font-mono text-sm">
            npm install -g @anthropic-ai/claude-code
          </div>
          <UButton
            :label="t('onboarding.recheck')"
            variant="outline"
            :loading="isChecking"
            @click="handleRecheck"
          />
        </div>
        <UButton
          v-if="status?.claudeInstalled"
          :label="t('onboarding.next')"
          @click="currentStep = status.claudeAuthenticated ? (status.hasSessions ? 4 : 3) : 2"
        />
      </template>

      <!-- Auth Check -->
      <template v-if="currentStep === 2">
        <UIcon name="i-lucide-key-round" class="size-12 text-primary" />
        <h2 class="text-xl font-bold">{{ t('onboarding.authTitle') }}</h2>
        <div v-if="status?.claudeAuthenticated" class="flex items-center gap-2 text-green-600">
          <UIcon name="i-lucide-check-circle" class="size-5" />
          <span class="text-base">{{ t('onboarding.authDone') }}</span>
        </div>
        <div v-else class="flex flex-col gap-4">
          <p class="text-base text-muted">{{ t('onboarding.authNotDone') }}</p>
          <div class="rounded-lg bg-elevated px-4 py-3 font-mono text-sm">
            claude auth login
          </div>
          <UButton
            :label="t('onboarding.recheck')"
            variant="outline"
            :loading="isChecking"
            @click="handleRecheck"
          />
        </div>
        <UButton
          v-if="status?.claudeAuthenticated"
          :label="t('onboarding.next')"
          @click="currentStep = status.hasSessions ? 4 : 3"
        />
      </template>

      <!-- Sync -->
      <template v-if="currentStep === 3">
        <UIcon name="i-lucide-database" class="size-12 text-primary" />
        <h2 class="text-xl font-bold">{{ t('onboarding.syncTitle') }}</h2>
        <div v-if="status?.hasSessions" class="flex items-center gap-2 text-green-600">
          <UIcon name="i-lucide-check-circle" class="size-5" />
          <span class="text-base">{{ t('onboarding.syncDone') }}</span>
        </div>
        <div v-else class="flex flex-col gap-4">
          <p class="text-base text-muted">{{ t('onboarding.syncDesc') }}</p>
          <UButton
            :label="t('onboarding.syncNow')"
            :loading="isSyncing"
            @click="handleSync"
          />
          <p class="text-sm text-muted">{{ t('onboarding.syncHint') }}</p>
        </div>
        <UButton
          v-if="status?.hasSessions"
          :label="t('onboarding.next')"
          @click="currentStep = 4"
        />
      </template>

      <!-- Done -->
      <template v-if="currentStep === 4">
        <UIcon name="i-lucide-check-circle" class="size-12 text-green-500" />
        <h2 class="text-xl font-bold">{{ t('onboarding.doneTitle') }}</h2>
        <p class="text-base text-muted">{{ t('onboarding.doneDesc') }}</p>
        <UButton :label="t('onboarding.openDashboard')" size="lg" @click="handleComplete" />
      </template>
    </div>

    <!-- Dev nav -->
    <div v-if="isDev" class="flex items-center gap-2">
      <UButton
        label="Back"
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="sm"
        :disabled="currentStep === 0"
        @click="currentStep--"
      />
      <span class="text-sm text-muted">Step {{ currentStep + 1 }}/{{ steps.length }}</span>
      <UButton
        label="Next"
        icon="i-lucide-arrow-right"
        trailing
        variant="ghost"
        size="sm"
        :disabled="currentStep >= steps.length - 1"
        @click="currentStep++"
      />
    </div>

    <!-- Skip link -->
    <UButton
      v-if="currentStep < 4"
      :label="t('onboarding.skip')"
      variant="link"
      color="neutral"
      @click="handleSkip"
    />
  </div>
</template>
