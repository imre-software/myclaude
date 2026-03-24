<script setup lang="ts">
import type { NotificationWindowType } from '~/types/notifications'

const { t } = useI18n()
const store = useNotificationStore()

const presetLevels = [50, 75, 90, 95]

const cooldownOptions = computed(() => [
  { label: t('notifications.cooldown15min'), value: 15 },
  { label: t('notifications.cooldown30min'), value: 30 },
  { label: t('notifications.cooldown1hr'), value: 60 },
  { label: t('notifications.cooldown2hr'), value: 120 },
])

const soundOptions = computed(() => [
  { label: t('notifications.soundDefault'), value: 'default' },
  { label: t('notifications.soundPing'), value: 'Ping' },
  { label: t('notifications.soundGlass'), value: 'Glass' },
  { label: t('notifications.soundHero'), value: 'Hero' },
  { label: t('notifications.soundNone'), value: 'none' },
])

const windowConfigs: Array<{ key: NotificationWindowType, label: string }> = [
  { key: 'fiveHour', label: t('notifications.fiveHourWindow') },
  { key: 'sevenDay', label: t('notifications.sevenDayWindow') },
  { key: 'sevenDaySonnet', label: t('notifications.sevenDaySonnetWindow') },
]

const customInputs = ref<Record<NotificationWindowType, string>>({
  fiveHour: '',
  sevenDay: '',
  sevenDaySonnet: '',
})

function sortedLevels(key: NotificationWindowType) {
  return [...store.settings.thresholds[key].levels].sort((a, b) => a - b)
}

async function handleToggleEnabled(value: boolean) {
  await store.updateSettings({ enabled: value })
}

async function handleToggleWindow(key: NotificationWindowType, value: boolean) {
  await store.updateSettings({
    thresholds: { [key]: { ...store.settings.thresholds[key], enabled: value } },
  })
}

async function toggleLevel(key: NotificationWindowType, level: number) {
  const current = store.settings.thresholds[key].levels
  const levels = current.includes(level)
    ? current.filter(l => l !== level)
    : [...current, level].sort((a, b) => a - b)
  await store.updateSettings({
    thresholds: { [key]: { ...store.settings.thresholds[key], levels } },
  })
}

async function handleRemoveLevel(key: NotificationWindowType, level: number) {
  const levels = store.settings.thresholds[key].levels.filter(l => l !== level)
  await store.updateSettings({
    thresholds: { [key]: { ...store.settings.thresholds[key], levels } },
  })
}

async function handleAddCustomLevel(key: NotificationWindowType) {
  const value = Number(customInputs.value[key])
  if (!Number.isInteger(value) || value < 1 || value > 100) return
  if (store.settings.thresholds[key].levels.includes(value)) {
    customInputs.value[key] = ''
    return
  }
  const levels = [...store.settings.thresholds[key].levels, value].sort((a, b) => a - b)
  await store.updateSettings({
    thresholds: { [key]: { ...store.settings.thresholds[key], levels } },
  })
  customInputs.value[key] = ''
}

function customLevels(key: NotificationWindowType) {
  return sortedLevels(key).filter(l => !presetLevels.includes(l))
}

async function handleCooldownChange(value: number) {
  await store.updateSettings({ cooldownMinutes: value })
}

async function handleSoundChange(value: string) {
  await store.updateSettings({ sound: value })
}

async function handleToggleCloseToTray(value: boolean) {
  await store.updateSettings({ closeToTray: value })
}

const toast = useToast()

async function handleRequestPermission() {
  await store.requestPermission()
}

async function handleTestNotification() {
  const result = await store.sendTestNotification()
  if (result.ok) {
    toast.add({ title: t('notifications.testSent'), color: 'success' })
  } else {
    toast.add({ title: t('notifications.testFailed'), description: result.error, color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-xl">
    <div>
      <h3 class="text-base font-medium">{{ t('notifications.title') }}</h3>
      <p class="text-sm text-muted">{{ t('notifications.description') }}</p>
    </div>

    <!-- Master toggle -->
    <div class="flex items-center justify-between">
      <p class="text-base">{{ t('notifications.enableDesktop') }}</p>
      <USwitch
        :model-value="store.settings.enabled"
        @update:model-value="handleToggleEnabled"
      />
    </div>

    <!-- Close to tray -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-base">{{ t('notifications.closeToTray') }}</p>
        <p class="text-sm text-muted">{{ t('notifications.closeToTrayDesc') }}</p>
      </div>
      <USwitch
        :model-value="store.settings.closeToTray"
        @update:model-value="handleToggleCloseToTray"
      />
    </div>

    <!-- Permission status -->
    <div v-if="store.settings.enabled && store.permissionStatus !== 'granted'" class="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-shield-alert" class="size-5 text-yellow-600 dark:text-yellow-400" />
        <p class="text-base text-yellow-700 dark:text-yellow-300">{{ t('notifications.permissionNotDetermined') }}</p>
      </div>
      <UButton
        icon="i-lucide-bell"
        @click="handleRequestPermission"
      >
        {{ t('notifications.requestPermission') }}
      </UButton>
    </div>

    <!-- Threshold config per window -->
    <div v-if="store.settings.enabled" class="flex flex-col gap-5">
      <div>
        <h4 class="text-base font-medium">{{ t('notifications.thresholds') }}</h4>
        <p class="text-sm text-muted">{{ t('notifications.thresholdsDesc') }}</p>
      </div>

      <div v-for="win in windowConfigs" :key="win.key" class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <p class="text-base">{{ win.label }}</p>
          <USwitch
            :model-value="store.settings.thresholds[win.key].enabled"
            @update:model-value="handleToggleWindow(win.key, $event)"
          />
        </div>

        <div v-if="store.settings.thresholds[win.key].enabled" class="flex flex-col gap-3 ps-4">
          <div>
            <p class="text-sm text-muted mb-1.5">{{ t('notifications.presets') }}</p>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                v-for="level in presetLevels"
                :key="level"
                :variant="store.settings.thresholds[win.key].levels.includes(level) ? 'solid' : 'outline'"
                class="cursor-pointer select-none"
                @click="toggleLevel(win.key, level)"
              >
                {{ level }}%
              </UBadge>
            </div>
          </div>

          <div>
            <p class="text-sm text-muted mb-1.5">{{ t('notifications.custom') }}</p>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                v-for="level in customLevels(win.key)"
                :key="'custom-' + level"
                variant="solid"
                class="cursor-pointer select-none"
                @click="handleRemoveLevel(win.key, level)"
              >
                {{ level }}%
                <UIcon name="i-lucide-x" class="ms-0.5 size-3" />
              </UBadge>
              <div class="flex items-center gap-1">
                <UInput
                  v-model="customInputs[win.key]"
                  type="number"
                  :min="1"
                  :max="100"
                  :placeholder="t('notifications.customPlaceholder')"
                  class="w-20"
                  size="xs"
                  @keyup.enter="handleAddCustomLevel(win.key)"
                />
                <UButton
                  icon="i-lucide-plus"
                  variant="ghost"
                  size="xs"
                  @click="handleAddCustomLevel(win.key)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cooldown -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UFormField :label="t('notifications.cooldown')">
          <USelect
            :model-value="store.settings.cooldownMinutes"
            :items="cooldownOptions"
            value-key="value"
            class="w-full"
            @update:model-value="handleCooldownChange"
          />
        </UFormField>

        <UFormField :label="t('notifications.sound')">
          <USelect
            :model-value="store.settings.sound"
            :items="soundOptions"
            value-key="value"
            class="w-full"
            @update:model-value="handleSoundChange"
          />
        </UFormField>
      </div>

      <!-- Test button -->
      <div>
        <UButton
          icon="i-lucide-bell-ring"
          variant="outline"
          @click="handleTestNotification"
        >
          {{ t('notifications.testButton') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
