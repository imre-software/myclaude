<script setup lang="ts">
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

const { t } = useI18n()

const updateAvailable = ref(false)
const updateVersion = ref('')
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadTotal = ref(0)
const isDismissed = ref(false)

onMounted(async () => {
  if (!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) return

  try {
    const update = await check()
    if (update) {
      updateVersion.value = update.version
      updateAvailable.value = true
    }
  } catch {
    // Update check failed silently
  }
})

const handleUpdate = async () => {
  isDownloading.value = true
  try {
    const update = await check()
    if (!update) return

    await update.downloadAndInstall((event) => {
      if (event.event === 'Started' && event.data.contentLength) {
        downloadTotal.value = event.data.contentLength
      } else if (event.event === 'Progress') {
        downloadProgress.value += event.data.chunkLength
      }
    })

    await relaunch()
  } catch {
    isDownloading.value = false
  }
}

const handleDismiss = () => {
  isDismissed.value = true
}

const progressPercent = computed(() => {
  if (downloadTotal.value === 0) return 0
  return Math.round((downloadProgress.value / downloadTotal.value) * 100)
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300"
    leave-active-class="transition-all duration-300"
    enter-from-class="-translate-y-full opacity-0"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="updateAvailable && !isDismissed"
      class="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-4 bg-primary px-4 py-2 text-white"
    >
      <template v-if="isDownloading">
        <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
        <span class="text-sm">{{ t('update.downloading', { percent: progressPercent }) }}</span>
      </template>
      <template v-else>
        <UIcon name="i-lucide-download" class="size-4" />
        <span class="text-sm">{{ t('update.available', { version: updateVersion }) }}</span>
        <UButton
          :label="t('update.install')"
          size="xs"
          color="neutral"
          variant="solid"
          @click="handleUpdate"
        />
        <UButton
          :label="t('update.later')"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="handleDismiss"
        />
      </template>
    </div>
  </Transition>
</template>
