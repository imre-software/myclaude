<script setup lang="ts">
import type { AgentDefinition } from '~~/app/types/settings'
import type { GenerateResponse } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  agents: AgentDefinition[]
}>()

const { saveAgent, deleteAgent } = useSettingsData()

const isAiDialogOpen = ref(false)
const editingAgent = ref<AgentDefinition | null>(null)
const isEditing = ref(false)

async function handleGenerated(result: GenerateResponse) {
  await saveAgent('user', result.filename, result.content)
}

async function handleDelete(agent: AgentDefinition) {
  await deleteAgent(agent.scope, agent.filename)
}

function handleEdit(agent: AgentDefinition) {
  editingAgent.value = { ...agent }
  isEditing.value = true
}

async function handleSaveEdit(content: string) {
  if (!editingAgent.value) return
  await saveAgent(editingAgent.value.scope, editingAgent.value.filename, content)
  isEditing.value = false
  editingAgent.value = null
}

function handleCancelEdit() {
  isEditing.value = false
  editingAgent.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-base font-medium">{{ t('settings.agents') }}</h3>
        <p class="text-sm text-muted">{{ t('settings.agentsDesc') }}</p>
      </div>
      <UButton
        :label="t('settings.createWithAi')"
        icon="i-lucide-sparkles"
        size="sm"
        variant="outline"
        @click="isAiDialogOpen = true"
      />
    </div>

    <div v-if="!agents.length" class="flex flex-col items-center gap-2 py-8 text-muted">
      <UIcon name="i-lucide-bot" class="size-8" />
      <p class="text-sm">{{ t('settings.noAgents') }}</p>
    </div>

    <UCard v-if="isEditing && editingAgent">
      <SettingsMarkdownEditor
        :title="editingAgent.name"
        :content="editingAgent.content"
        @save="handleSaveEdit"
        @cancel="handleCancelEdit"
      />
    </UCard>

    <UCard v-for="agent in agents" v-else :key="agent.filename">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <UIcon name="i-lucide-bot" class="size-4 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-base font-medium truncate">{{ agent.name }}</p>
            <p class="text-sm text-muted truncate">{{ agent.description || agent.filename }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UBadge :label="agent.scope" variant="subtle" size="sm" />
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            size="xs"
            @click="handleEdit(agent)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="xs"
            @click="handleDelete(agent)"
          />
        </div>
      </div>
    </UCard>

    <SettingsAiGenerateDialog
      v-model:open="isAiDialogOpen"
      type="agent"
      @generated="handleGenerated"
    />
  </div>
</template>
