<script setup lang="ts">
import type { SkillDefinition } from '~~/app/types/settings'
import type { GenerateResponse } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  skills: SkillDefinition[]
}>()

const { saveSkill, deleteSkill } = useSettingsData()

const isAiDialogOpen = ref(false)
const editingSkill = ref<SkillDefinition | null>(null)
const isEditing = ref(false)

async function handleGenerated(result: GenerateResponse) {
  await saveSkill('user', result.name, result.content)
}

async function handleDelete(skill: SkillDefinition) {
  await deleteSkill(skill.scope, skill.dirname)
}

function handleEdit(skill: SkillDefinition) {
  editingSkill.value = { ...skill }
  isEditing.value = true
}

async function handleSaveEdit(content: string) {
  if (!editingSkill.value) return
  await saveSkill(editingSkill.value.scope, editingSkill.value.dirname, content)
  isEditing.value = false
  editingSkill.value = null
}

function handleCancelEdit() {
  isEditing.value = false
  editingSkill.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-base font-medium">{{ t('settings.skills') }}</h3>
        <p class="text-sm text-muted">{{ t('settings.skillsDesc') }}</p>
      </div>
      <UButton
        :label="t('settings.createWithAi')"
        icon="i-lucide-sparkles"
        size="sm"
        variant="outline"
        @click="isAiDialogOpen = true"
      />
    </div>

    <div v-if="!skills.length" class="flex flex-col items-center gap-2 py-8 text-muted">
      <UIcon name="i-lucide-zap" class="size-8" />
      <p class="text-sm">{{ t('settings.noSkills') }}</p>
    </div>

    <UCard v-if="isEditing && editingSkill">
      <SettingsMarkdownEditor
        :title="editingSkill.name"
        :content="editingSkill.content"
        @save="handleSaveEdit"
        @cancel="handleCancelEdit"
      />
    </UCard>

    <UCard v-for="skill in skills" v-else :key="skill.dirname">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <UIcon name="i-lucide-zap" class="size-4 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-base font-medium truncate">{{ skill.name }}</p>
            <p class="text-sm text-muted truncate">{{ skill.description || skill.dirname }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UBadge :label="skill.scope" variant="subtle" size="sm" />
          <UBadge v-if="skill.userInvocable" label="invocable" variant="outline" size="sm" />
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            size="xs"
            @click="handleEdit(skill)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="xs"
            @click="handleDelete(skill)"
          />
        </div>
      </div>
    </UCard>

    <SettingsAiGenerateDialog
      v-model:open="isAiDialogOpen"
      type="skill"
      @generated="handleGenerated"
    />
  </div>
</template>
