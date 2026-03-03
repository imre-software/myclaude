<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  title: string
  content: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  save: [content: string]
  cancel: []
}>()

const editContent = ref(props.content)
const isEditing = ref(false)

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
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-base font-medium">{{ title }}</span>
      <div v-if="!readonly" class="flex gap-2">
        <template v-if="isEditing">
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
    <UTextarea
      v-model="editContent"
      :rows="12"
      autoresize
      :maxrows="30"
      class="w-full font-mono"
      :disabled="!isEditing && !readonly"
      :readonly="readonly || !isEditing"
    />
  </div>
</template>
