<script setup lang="ts">
import type { HookEntry, HookEvent } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  hooks: HookEntry[]
}>()

const { saveAllHooks, loadHooks } = useSettingsData()

const isAiDialogOpen = ref(false)
const isAdding = ref(false)
const isSaving = ref(false)

const newHook = ref({
  event: 'PreToolUse' as HookEvent,
  matcher: '',
  command: '',
  timeout: 600,
})

async function handleHookCreated() {
  await loadHooks()
}

async function handleAdd() {
  if (!newHook.value.command.trim()) return
  isSaving.value = true

  try {
    const entry: HookEntry = {
      event: newHook.value.event,
      matcher: newHook.value.matcher || undefined,
      handlers: [{
        type: 'command',
        command: newHook.value.command,
        timeout: newHook.value.timeout,
      }],
    }
    const updated = [...props.hooks, entry]
    await saveAllHooks(updated)
    isAdding.value = false
    newHook.value = { event: 'PreToolUse', matcher: '', command: '', timeout: 600 }
  } finally {
    isSaving.value = false
  }
}

async function handleRemove(index: number) {
  const updated = props.hooks.filter((_, i) => i !== index)
  await saveAllHooks(updated)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-base font-medium">{{ t('settings.hooks') }}</h3>
        <p class="text-sm text-muted">{{ t('settings.hooksDesc') }}</p>
      </div>
      <div class="flex gap-2">
        <UButton
          :label="t('settings.createWithAi')"
          icon="i-lucide-sparkles"
          size="sm"
          variant="outline"
          @click="isAiDialogOpen = true"
        />
        <UButton
          label="Add manually"
          icon="i-lucide-plus"
          size="sm"
          variant="outline"
          @click="isAdding = !isAdding"
        />
      </div>
    </div>

    <UCard v-if="isAdding">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingsHookEventSelect v-model="newHook.event" />
          <UFormField :label="t('settings.matcher')">
            <UInput v-model="newHook.matcher" placeholder="Bash, Write, etc." class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('settings.command')">
          <UInput v-model="newHook.command" placeholder="echo 'hook triggered'" class="w-full font-mono" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton :label="t('settings.cancel')" variant="ghost" size="sm" @click="isAdding = false" />
          <UButton :label="t('settings.save')" size="sm" :loading="isSaving" :disabled="!newHook.command.trim()" @click="handleAdd" />
        </div>
      </div>
    </UCard>

    <div v-if="!hooks.length && !isAdding" class="flex flex-col items-center gap-2 py-8 text-muted">
      <UIcon name="i-lucide-webhook" class="size-8" />
      <p class="text-sm">{{ t('settings.noHooks') }}</p>
    </div>

    <UCard v-for="(hook, index) in hooks" :key="index">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <UIcon name="i-lucide-webhook" class="size-4 text-primary" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <UBadge :label="hook.event" variant="subtle" size="sm" />
              <UBadge v-if="hook.matcher" :label="hook.matcher" variant="outline" size="sm" />
            </div>
            <p class="mt-1 text-sm text-muted truncate font-mono">
              {{ hook.handlers.map(h => h.command || h.url).join(', ') }}
            </p>
          </div>
        </div>
        <UButton
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="xs"
          @click="handleRemove(index)"
        />
      </div>
    </UCard>

    <SettingsAiGenerateDialog
      v-model:open="isAiDialogOpen"
      type="hook"
      @done="handleHookCreated"
    />
  </div>
</template>
