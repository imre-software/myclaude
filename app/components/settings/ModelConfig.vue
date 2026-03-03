<script setup lang="ts">
import type { ModelConfig } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  config: ModelConfig
  attribution: { commit: string, pr: string }
}>()

const { updateConfig } = useSettingsData()
const isSaving = ref(false)

const effortOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
]

const modelItems = computed(() =>
  props.config.availableModels.length
    ? props.config.availableModels.map(m => ({ label: m, value: m }))
    : [{ label: props.config.model || 'default', value: props.config.model || 'default' }],
)

async function handleModelChange(value: string) {
  isSaving.value = true
  try {
    await updateConfig('model', { model: value })
  } finally {
    isSaving.value = false
  }
}

async function handleEffortChange(value: string) {
  await updateConfig('model', { effortLevel: value })
}

async function handleToggle(key: keyof ModelConfig, value: boolean) {
  await updateConfig('model', { [key]: value })
}

async function handleAttributionChange(key: 'commit' | 'pr', value: string) {
  await updateConfig('attribution', { [key]: value })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-base font-medium">{{ t('settings.model') }}</h3>
      <p class="text-sm text-muted">{{ t('settings.modelDesc') }}</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField :label="t('settings.defaultModel')">
        <USelect
          :model-value="config.model"
          :items="modelItems"
          class="w-full"
          @update:model-value="handleModelChange"
        />
      </UFormField>

      <UFormField :label="t('settings.effortLevel')">
        <USelect
          :model-value="config.effortLevel"
          :items="effortOptions"
          class="w-full"
          @update:model-value="handleEffortChange"
        />
      </UFormField>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-base">{{ t('settings.extendedThinking') }}</p>
        </div>
        <USwitch
          :model-value="config.alwaysThinkingEnabled"
          @update:model-value="handleToggle('alwaysThinkingEnabled', $event)"
        />
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-base">{{ t('settings.fastModeOptIn') }}</p>
        </div>
        <USwitch
          :model-value="config.fastModePerSessionOptIn"
          @update:model-value="handleToggle('fastModePerSessionOptIn', $event)"
        />
      </div>
    </div>

    <USeparator />

    <div>
      <h3 class="text-base font-medium">{{ t('settings.account') }}</h3>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField :label="t('settings.commitAttribution')">
        <UInput
          :model-value="attribution.commit"
          placeholder="Co-Authored-By: ..."
          class="w-full"
          @change="handleAttributionChange('commit', ($event.target as HTMLInputElement).value)"
        />
      </UFormField>

      <UFormField :label="t('settings.prAttribution')">
        <UInput
          :model-value="attribution.pr"
          placeholder="Generated with..."
          class="w-full"
          @change="handleAttributionChange('pr', ($event.target as HTMLInputElement).value)"
        />
      </UFormField>
    </div>
  </div>
</template>
