<script setup lang="ts">
import type { AppearanceConfig } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  appearance: AppearanceConfig
}>()

const { updateConfig } = useSettingsData()

const themeOptions = [
  { label: 'Auto', value: 'auto' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
]

async function handleThemeChange(value: string) {
  await updateConfig('appearance', { theme: value })
}

async function handleToggle(key: keyof AppearanceConfig, value: boolean) {
  await updateConfig('appearance', { [key]: value })
}

async function handleLanguageChange(value: string) {
  await updateConfig('appearance', { language: value })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-base font-medium">{{ t('settings.appearance') }}</h3>
      <p class="text-sm text-muted">{{ t('settings.appearanceDesc') }}</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField :label="t('settings.theme')">
        <USelect
          :model-value="appearance.theme"
          :items="themeOptions"
          class="w-full"
          @update:model-value="handleThemeChange"
        />
      </UFormField>

      <UFormField :label="t('settings.language')">
        <UInput
          :model-value="appearance.language"
          placeholder="en, es, fr, ..."
          class="w-full"
          @change="handleLanguageChange(($event.target as HTMLInputElement).value)"
        />
      </UFormField>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <p class="text-base">{{ t('settings.showTurnDuration') }}</p>
        <USwitch
          :model-value="appearance.showTurnDuration"
          @update:model-value="handleToggle('showTurnDuration', $event)"
        />
      </div>

      <div class="flex items-center justify-between">
        <p class="text-base">{{ t('settings.spinnerTips') }}</p>
        <USwitch
          :model-value="appearance.spinnerTipsEnabled"
          @update:model-value="handleToggle('spinnerTipsEnabled', $event)"
        />
      </div>

      <div class="flex items-center justify-between">
        <p class="text-base">{{ t('settings.progressBar') }}</p>
        <USwitch
          :model-value="appearance.terminalProgressBarEnabled"
          @update:model-value="handleToggle('terminalProgressBarEnabled', $event)"
        />
      </div>
    </div>
  </div>
</template>
