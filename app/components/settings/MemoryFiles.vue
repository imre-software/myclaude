<script setup lang="ts">
import type { MemoryFile } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  files: MemoryFile[]
}>()

const { updateMemory } = useSettingsData()

const scopeLabels: Record<string, string> = {
  user: 'User (global)',
  project: 'Project',
  'project-local': 'Project (local)',
}

async function handleSave(file: MemoryFile, content: string) {
  await updateMemory(file.path, content)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-base font-medium">{{ t('settings.memory') }}</h3>
      <p class="text-sm text-muted">{{ t('settings.memoryDesc') }}</p>
    </div>

    <div v-if="!files.length" class="flex flex-col items-center gap-2 py-8 text-muted">
      <UIcon name="i-lucide-file-text" class="size-8" />
      <p class="text-sm">{{ t('settings.noMemoryFiles') }}</p>
    </div>

    <UCard v-for="file in files" :key="file.path">
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <UBadge :label="scopeLabels[file.scope] ?? file.scope" variant="subtle" size="sm" />
          <span class="text-sm text-muted font-mono">{{ file.label }}</span>
        </div>
        <SettingsMarkdownEditor
          :title="file.label"
          :content="file.content"
          :readonly="!file.writable"
          @save="handleSave(file, $event)"
        />
      </div>
    </UCard>
  </div>
</template>
