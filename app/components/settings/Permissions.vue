<script setup lang="ts">
import type { PermissionRules, PermissionMode } from '~~/app/types/settings'

const { t } = useI18n()

const props = defineProps<{
  permissions: PermissionRules
}>()

const { updateConfig } = useSettingsData()

const modeOptions = [
  { label: 'Default', value: 'default' },
  { label: 'Accept Edits', value: 'acceptEdits' },
  { label: 'Plan', value: 'plan' },
  { label: "Don't Ask", value: 'dontAsk' },
  { label: 'Bypass Permissions', value: 'bypassPermissions' },
]

const newAllowRule = ref('')
const newAskRule = ref('')
const newDenyRule = ref('')

async function handleModeChange(value: string) {
  await updateConfig('permissions', { defaultMode: value as PermissionMode })
}

async function handleAddRule(category: 'allow' | 'ask' | 'deny', rule: string) {
  if (!rule.trim()) return
  const current = [...props.permissions[category], rule.trim()]
  await updateConfig('permissions', { [category]: current })

  if (category === 'allow') newAllowRule.value = ''
  else if (category === 'ask') newAskRule.value = ''
  else newDenyRule.value = ''
}

async function handleRemoveRule(category: 'allow' | 'ask' | 'deny', index: number) {
  const current = [...props.permissions[category]]
  current.splice(index, 1)
  await updateConfig('permissions', { [category]: current })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-base font-medium">{{ t('settings.permissions') }}</h3>
      <p class="text-sm text-muted">{{ t('settings.permissionsDesc') }}</p>
    </div>

    <UFormField :label="t('settings.permissionMode')">
      <USelect
        :model-value="permissions.defaultMode"
        :items="modeOptions"
        class="w-full max-w-xs"
        @update:model-value="handleModeChange"
      />
    </UFormField>

    <div
      v-for="category in (['allow', 'ask', 'deny'] as const)"
      :key="category"
      class="flex flex-col gap-2"
    >
      <p class="text-base font-medium capitalize">{{ t(`settings.${category}Rules`) }}</p>

      <div v-for="(rule, index) in permissions[category]" :key="index" class="flex items-center gap-2">
        <UBadge :label="rule" variant="subtle" size="lg" class="font-mono" />
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="error"
          size="xs"
          @click="handleRemoveRule(category, index)"
        />
      </div>

      <div class="flex items-center gap-2">
        <UInput
          :model-value="category === 'allow' ? newAllowRule : category === 'ask' ? newAskRule : newDenyRule"
          :placeholder="t('settings.addRule')"
          class="w-full max-w-sm"
          @update:model-value="category === 'allow' ? newAllowRule = $event as string : category === 'ask' ? newAskRule = $event as string : newDenyRule = $event as string"
          @keydown.enter="handleAddRule(category, category === 'allow' ? newAllowRule : category === 'ask' ? newAskRule : newDenyRule)"
        />
        <UButton
          icon="i-lucide-plus"
          size="sm"
          variant="outline"
          @click="handleAddRule(category, category === 'allow' ? newAllowRule : category === 'ask' ? newAskRule : newDenyRule)"
        />
      </div>
    </div>
  </div>
</template>
