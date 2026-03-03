<script setup lang="ts">
import type { HookEvent } from '~~/app/types/settings'

const { t } = useI18n()

const modelValue = defineModel<HookEvent>({ required: true })

defineProps<{
  disabled?: boolean
}>()

const hookEventDescriptions: Record<HookEvent, string> = {
  PreToolUse: 'Runs before a tool call executes. Can allow, deny, or ask for confirmation.',
  PostToolUse: 'Runs after a tool call succeeds. Can block or modify the result.',
  PostToolUseFailure: 'Runs when a tool call fails. Use to log failures or send alerts.',
  SessionStart: 'Runs when a session begins or resumes. Use to load context or set up environment.',
  SessionEnd: 'Runs when a session terminates. Use for cleanup or logging.',
  UserPromptSubmit: 'Runs when the user submits a prompt, before Claude processes it.',
  Stop: 'Runs when Claude finishes responding. Can force Claude to continue.',
  Notification: 'Runs when Claude Code sends a notification (permission prompt, idle, etc.).',
  SubagentStart: 'Runs when a subagent is spawned via the Agent tool.',
  SubagentStop: 'Runs when a subagent finishes. Can force it to continue.',
  PreCompact: 'Runs before context compaction (manual or auto).',
}

const hookEvents: HookEvent[] = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'Stop', 'Notification', 'SubagentStart', 'SubagentStop', 'PreCompact',
]

const eventOptions = hookEvents.map(e => ({ label: e, value: e }))

const selectedDescription = computed(() => hookEventDescriptions[modelValue.value])
</script>

<template>
  <div class="flex flex-col gap-2">
    <UFormField :label="t('settings.event')">
      <USelect
        v-model="modelValue"
        :items="eventOptions"
        class="w-full"
        :disabled="disabled"
      />
    </UFormField>
    <p class="text-sm text-muted">{{ selectedDescription }}</p>
  </div>
</template>
