<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'

const { t } = useI18n()
const { aiUpdate } = useSettingsData()

const props = defineProps<{
  title: string
  content: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  save: [content: string]
  cancel: []
}>()

const editorRef = ref()
const editContent = ref(props.content)
const isEditing = ref(false)

watch(isEditing, (val) => {
  editorRef.value?.editor?.setEditable(val)
})

watch(() => props.content, (val) => {
  if (!isEditing.value) {
    editContent.value = val
  }
})

function handleEdit() {
  editContent.value = props.content
  isEditing.value = true
}

function handleSave() {
  emit('save', editContent.value)
  isEditing.value = false
}

function handleCancel() {
  editContent.value = props.content
  isEditing.value = false
  emit('cancel')
}

// AI Update
const isAiModalOpen = ref(false)
const aiPrompt = ref('')
const isAiUpdating = ref(false)
const aiError = ref('')

function openAiModal() {
  aiPrompt.value = ''
  aiError.value = ''
  isAiModalOpen.value = true
}

async function handleAiUpdate() {
  if (!aiPrompt.value.trim()) return

  isAiUpdating.value = true
  aiError.value = ''

  try {
    const updated = await aiUpdate(editContent.value, aiPrompt.value.trim())
    editContent.value = updated
    isAiModalOpen.value = false
  } catch (e) {
    aiError.value = e instanceof Error ? e.message : String(e)
  } finally {
    isAiUpdating.value = false
  }
}

const toolbarItems: EditorToolbarItem[][] = [
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold' },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic' },
    { kind: 'mark', mark: 'code', icon: 'i-lucide-code' },
  ],
  [
    { kind: 'heading', level: 1, icon: 'i-lucide-heading-1' },
    { kind: 'heading', level: 2, icon: 'i-lucide-heading-2' },
    { kind: 'heading', level: 3, icon: 'i-lucide-heading-3' },
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list' },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered' },
  ],
  [
    { kind: 'blockquote', icon: 'i-lucide-quote' },
    { kind: 'codeBlock', icon: 'i-lucide-square-code' },
    { kind: 'link', icon: 'i-lucide-link' },
  ],
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-base font-medium">{{ title }}</span>
      <div v-if="!readonly" class="flex gap-2">
        <template v-if="isEditing">
          <UButton
            icon="i-lucide-sparkles"
            variant="ghost"
            size="xs"
            :label="t('settings.updateWithAi')"
            @click="openAiModal"
          />
          <UButton
            :label="t('settings.cancel')"
            variant="ghost"
            size="xs"
            @click="handleCancel"
          />
          <UButton
            :label="t('settings.save')"
            size="xs"
            @click="handleSave"
          />
        </template>
        <UButton
          v-else
          :label="t('settings.edit')"
          variant="ghost"
          size="xs"
          icon="i-lucide-pencil"
          @click="handleEdit"
        />
      </div>
    </div>
    <div class="rounded-md border border-(--ui-border)">
      <UEditor
        ref="editorRef"
        v-slot="{ editor }"
        v-model="editContent"
        content-type="markdown"
        :editable="isEditing"
        :ui="{ content: 'min-h-48 max-h-[60vh] overflow-y-auto px-4 py-3' }"
      >
        <UEditorToolbar
          v-if="isEditing"
          :editor="editor"
          :items="toolbarItems"
          size="md"
          class="border-b border-(--ui-border)"
        />
      </UEditor>
    </div>

    <UModal v-model:open="isAiModalOpen" :title="t('settings.updateWithAi')">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField :label="t('settings.aiUpdatePromptLabel')">
            <UTextarea
              v-model="aiPrompt"
              :placeholder="t('settings.aiUpdatePromptPlaceholder')"
              autofocus
              :rows="3"
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="aiError"
            color="error"
            icon="i-lucide-circle-alert"
            :description="aiError"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            :label="t('settings.cancel')"
            variant="ghost"
            @click="isAiModalOpen = false"
          />
          <UButton
            :label="t('settings.update')"
            icon="i-lucide-sparkles"
            :loading="isAiUpdating"
            :disabled="!aiPrompt.trim()"
            @click="handleAiUpdate"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
