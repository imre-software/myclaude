<script setup lang="ts">
import type { GenerateResponse } from '~~/app/types/settings'
import type { HookEvent } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  type: 'skill' | 'agent' | 'hook'
}>()

const emit = defineEmits<{
  generated: [result: GenerateResponse]
  done: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const prompt = ref('')
const isGenerating = ref(false)
const hookDone = ref(false)
const error = ref('')
const preview = ref<GenerateResponse | null>(null)

const selectedEvent = ref<HookEvent>('PreToolUse')

const { generate } = useSettingsData()

async function handleGenerate() {
  if (!prompt.value.trim()) return
  isGenerating.value = true
  error.value = ''
  preview.value = null

  try {
    let fullPrompt = prompt.value.trim()
    if (props.type === 'hook') {
      fullPrompt = `Event: ${selectedEvent.value}. ${fullPrompt}`
    }
    const result = await generate(props.type, fullPrompt)
    if (props.type === 'hook') {
      hookDone.value = true
      emit('done')
    } else {
      preview.value = result
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Generation failed'
  } finally {
    isGenerating.value = false
  }
}

function handleSave() {
  if (preview.value) {
    emit('generated', preview.value)
    handleClose()
  }
}

function handleClose() {
  isOpen.value = false
  prompt.value = ''
  preview.value = null
  error.value = ''
  isGenerating.value = false
  hookDone.value = false
  selectedEvent.value = 'PreToolUse'
}
</script>

<template>
  <UModal
    :open="isOpen"
    :title="t('settings.createWithAi')"
    :dismissible="!isGenerating"
    :close="!isGenerating"
    @update:open="isOpen = $event"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <SettingsHookEventSelect
          v-if="type === 'hook'"
          v-model="selectedEvent"
          :disabled="isGenerating"
        />

        <UFormField :label="t('settings.aiPromptPlaceholder')">
          <UTextarea
            v-model="prompt"
            :placeholder="type === 'hook' ? 'Describe what the hook should do...' : t('settings.aiPromptPlaceholder')"
            :rows="3"
            autoresize
            class="w-full"
            :disabled="isGenerating"
          />
        </UFormField>

        <UButton
          :label="isGenerating ? t('settings.generating') : 'Generate'"
          icon="i-lucide-sparkles"
          :loading="isGenerating"
          :disabled="!prompt.trim()"
          @click="handleGenerate"
        />

        <UAlert
          v-if="isGenerating"
          color="info"
          :title="t('settings.generatingHint')"
          icon="i-lucide-loader"
        />

        <UAlert
          v-if="hookDone"
          color="success"
          :title="t('settings.hookCreatedSuccess')"
          icon="i-lucide-check-circle"
        />

        <UAlert
          v-if="error"
          color="error"
          :title="error"
          icon="i-lucide-alert-circle"
        />

        <div v-if="preview" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-base font-medium">{{ t('settings.preview') }}</span>
            <UBadge :label="preview.name" variant="subtle" />
          </div>
          <div class="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <pre class="whitespace-pre-wrap text-sm font-mono">{{ preview.content }}</pre>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <UButton
          v-if="hookDone"
          :label="t('settings.done')"
          icon="i-lucide-check"
          @click="handleClose"
        />
        <template v-else>
          <UButton
            :label="t('settings.cancel')"
            variant="ghost"
            :disabled="isGenerating"
            @click="handleClose"
          />
          <UButton
            v-if="preview"
            :label="t('settings.save')"
            @click="handleSave"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
