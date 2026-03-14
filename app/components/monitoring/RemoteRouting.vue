<script setup lang="ts">
import type { ProjectRoutingRule, DiscoveredTelegramGroup, DiscoveredWhatsAppGroup } from '~/types/remote'
import type { ProjectStats } from '~/types/stats'

const { t } = useI18n()
const toast = useToast()
const store = useNotificationStore()

// Routing rules
const rules = ref<ProjectRoutingRule[]>([])
const isLoadingRules = ref(false)

// Group discovery
const telegramGroups = ref<DiscoveredTelegramGroup[]>([])
const whatsappGroups = ref<DiscoveredWhatsAppGroup[]>([])
const isLoadingTgGroups = ref(false)
const isLoadingWaGroups = ref(false)

// Known projects for autocomplete
const knownProjects = ref<string[]>([])

// Mention-only setting
const mentionOnly = ref(false)

// Add rule form
const isAdding = ref(false)
const isSaving = ref(false)
const newRule = ref({
  projectName: '',
  telegramChatId: null as string | null,
  telegramChatTitle: null as string | null,
  whatsappJid: null as string | null,
  whatsappName: null as string | null,
  whatsappPictureUrl: null as string | null,
})

const isWhatsAppConnected = computed(() => store.whatsappStatus.connection === 'connected')
const isTelegramConnected = computed(() => store.telegramStatus.connected)

// Selected group objects for trigger display
const selectedTgGroup = computed(() =>
  telegramGroups.value.find(g => g.id === newRule.value.telegramChatId),
)
const selectedWaGroup = computed(() =>
  whatsappGroups.value.find(g => g.jid === newRule.value.whatsappJid),
)

// SelectMenu items for Telegram groups
const telegramGroupItems = computed(() =>
  telegramGroups.value.map(g => ({
    label: g.title,
    value: g.id,
    description: g.type === 'supergroup' ? 'Supergroup' : 'Group',
  })),
)

// SelectMenu items for WhatsApp groups
const whatsappGroupItems = computed(() =>
  whatsappGroups.value.map(g => ({
    label: g.name,
    value: g.jid,
    avatar: g.pictureUrl ? { src: g.pictureUrl } : undefined,
    description: t('routing.participants', { count: g.size }),
  })),
)

// Project name items for autocomplete
const projectItems = computed(() =>
  knownProjects.value.map(name => ({
    label: name,
    value: name,
  })),
)

async function loadRules() {
  isLoadingRules.value = true
  try {
    rules.value = await $fetch<ProjectRoutingRule[]>('/api/routing/rules')
  } catch {
    // Ignore
  } finally {
    isLoadingRules.value = false
  }
}

async function loadMentionOnly() {
  try {
    const settings = await $fetch<{ telegram: { mentionOnly: boolean } }>('/api/notifications/settings')
    mentionOnly.value = settings.telegram?.mentionOnly ?? false
  } catch {
    // Ignore
  }
}

async function handleMentionOnlyToggle(value: boolean) {
  mentionOnly.value = value
  try {
    await $fetch('/api/notifications/settings', {
      method: 'PUT',
      body: { telegram: { mentionOnly: value } },
    })
  } catch {
    mentionOnly.value = !value
  }
}

async function loadTelegramGroups() {
  isLoadingTgGroups.value = true
  try {
    telegramGroups.value = await $fetch<DiscoveredTelegramGroup[]>('/api/telegram/groups')
  } catch {
    // Ignore
  } finally {
    isLoadingTgGroups.value = false
  }
}

async function loadWhatsAppGroups() {
  isLoadingWaGroups.value = true
  try {
    whatsappGroups.value = await $fetch<DiscoveredWhatsAppGroup[]>('/api/whatsapp/groups')
  } catch (err) {
    if (import.meta.dev) console.error('[routing] failed to load WhatsApp groups:', err)
  } finally {
    isLoadingWaGroups.value = false
  }
}

async function loadProjects() {
  try {
    const projects = await $fetch<ProjectStats[]>('/api/stats/projects')
    knownProjects.value = projects.map(p => p.name)
  } catch {
    // Ignore
  }
}

function handleTelegramGroupSelect(value: string | null) {
  if (!value) return
  const group = telegramGroups.value.find(g => g.id === value)
  newRule.value.telegramChatId = value
  newRule.value.telegramChatTitle = group?.title ?? null
}

function handleWhatsAppGroupSelect(value: string | null) {
  if (!value) return
  const group = whatsappGroups.value.find(g => g.jid === value)
  newRule.value.whatsappJid = value
  newRule.value.whatsappName = group?.name ?? null
  newRule.value.whatsappPictureUrl = group?.pictureUrl ?? null
}

function handleProjectSelect(value: string | null) {
  if (!value) return
  newRule.value.projectName = value
}

function resetForm() {
  isAdding.value = false
  newRule.value = {
    projectName: '',
    telegramChatId: null,
    telegramChatTitle: null,
    whatsappJid: null,
    whatsappName: null,
    whatsappPictureUrl: null,
  }
}

async function handleSave() {
  if (!newRule.value.projectName) return

  isSaving.value = true
  try {
    await $fetch('/api/routing/rules', {
      method: 'POST',
      body: newRule.value,
    })
    toast.add({ title: t('routing.savedToast'), color: 'success' })
    resetForm()
    await loadRules()
  } catch {
    toast.add({ title: t('routing.saveFailed'), color: 'error' })
  } finally {
    isSaving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await $fetch(`/api/routing/${id}`, { method: 'DELETE' })
    toast.add({ title: t('routing.deletedToast'), color: 'success' })
    await loadRules()
  } catch {
    toast.add({ title: t('routing.deleteFailed'), color: 'error' })
  }
}

async function handleToggleEnabled(rule: ProjectRoutingRule) {
  try {
    await $fetch('/api/routing/rules', {
      method: 'POST',
      body: {
        projectName: rule.projectName,
        telegramChatId: rule.telegramChatId,
        telegramChatTitle: rule.telegramChatTitle,
        whatsappJid: rule.whatsappJid,
        whatsappName: rule.whatsappName,
        whatsappPictureUrl: rule.whatsappPictureUrl,
        enabled: !rule.enabled,
      },
    })
    await loadRules()
  } catch {
    // Ignore
  }
}

function handleStartAdd() {
  isAdding.value = true
  if (isTelegramConnected.value && telegramGroups.value.length === 0) {
    loadTelegramGroups()
  }
  if (isWhatsAppConnected.value && whatsappGroups.value.length === 0) {
    loadWhatsAppGroups()
  }
}

onMounted(() => {
  loadRules()
  loadMentionOnly()
  loadProjects()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl">
    <!-- Header -->
    <div>
      <h3 class="text-base font-medium">{{ t('routing.title') }}</h3>
      <p class="text-sm text-muted">{{ t('routing.description') }}</p>
    </div>

    <!-- Telegram mention-only toggle -->
    <div
      v-if="isTelegramConnected"
      class="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-at-sign" class="size-5 text-muted" />
        <div>
          <p class="text-base font-medium">{{ t('routing.mentionOnlyLabel') }}</p>
          <p class="text-sm text-muted">{{ t('routing.mentionOnlyDesc') }}</p>
        </div>
      </div>
      <USwitch
        :model-value="mentionOnly"
        @update:model-value="handleMentionOnlyToggle"
      />
    </div>

    <!-- Routing rules section -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h4 class="text-base font-medium">{{ t('routing.rulesSection') }}</h4>
        <UButton
          v-if="!isAdding"
          icon="i-lucide-plus"
          size="sm"
          variant="outline"
          @click="handleStartAdd"
        >
          {{ t('routing.addRule') }}
        </UButton>
      </div>

      <!-- Empty state -->
      <p v-if="rules.length === 0 && !isAdding" class="text-sm text-muted">
        {{ t('routing.noRules') }}
      </p>

      <!-- Existing rules -->
      <div
        v-for="rule in rules"
        :key="rule.id"
        class="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      >
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <p class="text-base font-medium truncate">{{ rule.projectName }}</p>
          <div class="flex items-center gap-4 flex-wrap">
            <div v-if="rule.telegramChatTitle" class="flex items-center gap-1.5">
              <UIcon name="i-lucide-send" class="size-3.5 text-muted" />
              <span class="text-sm text-muted">{{ rule.telegramChatTitle }}</span>
            </div>
            <div v-if="rule.whatsappName" class="flex items-center gap-1.5">
              <UIcon name="i-lucide-message-circle" class="size-3.5 text-muted" />
              <span class="text-sm text-muted">{{ rule.whatsappName }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 ms-3">
          <USwitch
            :model-value="rule.enabled"
            @update:model-value="handleToggleEnabled(rule)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="sm"
            @click="handleDelete(rule.id)"
          />
        </div>
      </div>

      <!-- Add rule form -->
      <div
        v-if="isAdding"
        class="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      >
        <!-- Project name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">{{ t('routing.projectName') }}</label>
          <USelectMenu
            :model-value="newRule.projectName || undefined"
            :items="projectItems"
            value-key="value"
            :placeholder="t('routing.projectPlaceholder')"
            create-item
            class="w-full"
            @update:model-value="handleProjectSelect"
            @create="(item: string) => newRule.projectName = item"
          />
        </div>

        <!-- Telegram group -->
        <div v-if="isTelegramConnected" class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">{{ t('routing.telegramGroup') }}</label>
            <UButton
              icon="i-lucide-refresh-cw"
              variant="ghost"
              size="xs"
              :loading="isLoadingTgGroups"
              @click="loadTelegramGroups"
            >
              {{ t('routing.refreshGroups') }}
            </UButton>
          </div>
          <USelectMenu
            :model-value="newRule.telegramChatId || undefined"
            :items="telegramGroupItems"
            value-key="value"
            :placeholder="t('routing.telegramGroupPlaceholder')"
            :loading="isLoadingTgGroups"
            clear
            class="w-full"
            :ui="{ base: 'h-auto py-2' }"
            @update:model-value="handleTelegramGroupSelect"
            @clear="newRule.telegramChatId = null; newRule.telegramChatTitle = null"
          >
            <!-- Trigger: Telegram chat-list style -->
            <template #default>
              <div class="flex items-center gap-3">
                <div class="flex items-center justify-center size-10 rounded-full shrink-0" :class="selectedTgGroup ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'">
                  <UIcon name="i-lucide-send" class="size-5" :class="selectedTgGroup ? 'text-blue-600 dark:text-blue-400' : 'text-muted'" />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-base truncate" :class="selectedTgGroup ? 'font-medium' : 'text-muted'">{{ selectedTgGroup?.title ?? t('routing.telegramGroupPlaceholder') }}</span>
                  <span v-if="selectedTgGroup" class="text-sm text-muted">{{ selectedTgGroup.type === 'supergroup' ? 'Supergroup' : 'Group' }}</span>
                  <span v-else class="text-sm text-muted">{{ t('routing.telegramGroupPlaceholder') }}</span>
                </div>
              </div>
            </template>

            <!-- Items: Telegram chat-list rows -->
            <template #item-leading="{ item }">
              <div
                v-if="item && typeof item === 'object'"
                class="flex items-center justify-center size-10 rounded-full bg-blue-100 dark:bg-blue-900 shrink-0"
              >
                <UIcon name="i-lucide-send" class="size-5 text-blue-600 dark:text-blue-400" />
              </div>
            </template>
          </USelectMenu>
          <p v-if="telegramGroups.length === 0 && !isLoadingTgGroups" class="text-sm text-muted">
            {{ t('routing.noTelegramGroups') }}
          </p>
        </div>

        <!-- WhatsApp group -->
        <div v-if="isWhatsAppConnected" class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">{{ t('routing.whatsappGroup') }}</label>
            <UButton
              icon="i-lucide-refresh-cw"
              variant="ghost"
              size="xs"
              :loading="isLoadingWaGroups"
              @click="loadWhatsAppGroups"
            >
              {{ t('routing.refreshGroups') }}
            </UButton>
          </div>
          <USelectMenu
            :model-value="newRule.whatsappJid || undefined"
            :items="whatsappGroupItems"
            value-key="value"
            :placeholder="t('routing.whatsappGroupPlaceholder')"
            :loading="isLoadingWaGroups"
            clear
            class="w-full"
            :ui="{ base: 'h-auto py-2' }"
            @update:model-value="handleWhatsAppGroupSelect"
            @clear="newRule.whatsappJid = null; newRule.whatsappName = null; newRule.whatsappPictureUrl = null"
          >
            <!-- Trigger: WhatsApp chat-list style -->
            <template #default>
              <div class="flex items-center gap-3">
                <img
                  v-if="selectedWaGroup?.pictureUrl"
                  :src="selectedWaGroup.pictureUrl"
                  class="size-10 rounded-full object-cover shrink-0"
                >
                <div
                  v-else
                  class="flex items-center justify-center size-10 rounded-full shrink-0"
                  :class="selectedWaGroup ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-800'"
                >
                  <UIcon name="i-lucide-users" class="size-5" :class="selectedWaGroup ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'" />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-base truncate" :class="selectedWaGroup ? 'font-medium' : 'text-muted'">{{ selectedWaGroup?.name ?? t('routing.whatsappGroupPlaceholder') }}</span>
                  <span v-if="selectedWaGroup" class="text-sm text-muted">{{ t('routing.participants', { count: selectedWaGroup.size }) }}</span>
                  <span v-else class="text-sm text-muted">{{ t('routing.whatsappGroupPlaceholder') }}</span>
                </div>
              </div>
            </template>

            <!-- Items: WhatsApp chat-list rows -->
            <template #item-leading="{ item }">
              <template v-if="item && typeof item === 'object'">
                <img
                  v-if="'avatar' in item && item.avatar?.src"
                  :src="item.avatar.src"
                  class="size-10 rounded-full object-cover shrink-0"
                >
                <div
                  v-else
                  class="flex items-center justify-center size-10 rounded-full bg-emerald-100 dark:bg-emerald-900 shrink-0"
                >
                  <UIcon name="i-lucide-users" class="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </template>
            </template>
          </USelectMenu>
          <p v-if="whatsappGroups.length === 0 && !isLoadingWaGroups" class="text-sm text-muted">
            {{ t('routing.noWhatsappGroups') }}
          </p>
        </div>

        <!-- Not connected hints -->
        <p v-if="!isTelegramConnected && !isWhatsAppConnected" class="text-sm text-muted">
          {{ t('routing.notConnected') }}
        </p>

        <!-- Actions -->
        <div class="flex items-center gap-2 justify-end">
          <UButton
            variant="ghost"
            @click="resetForm"
          >
            {{ t('routing.cancel') }}
          </UButton>
          <UButton
            :loading="isSaving"
            :disabled="!newRule.projectName || (!newRule.telegramChatId && !newRule.whatsappJid)"
            @click="handleSave"
          >
            {{ t('routing.save') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
