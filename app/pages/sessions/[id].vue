<script setup lang="ts">
import type { SessionDetail } from '~/types/stats'

const { t } = useI18n()
const route = useRoute()

definePageMeta({
  layout: 'dashboard',
})

const { data: session, status } = useFetch<SessionDetail>(`/api/stats/sessions/${route.params.id}`)

const assistantMessages = computed(() => {
  if (!session.value?.messages) return []
  return session.value.messages.filter(m => m.role === 'assistant')
})
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex items-center gap-4">
      <UButton
        icon="i-lucide-arrow-start"
        variant="ghost"
        color="neutral"
        to="/sessions"
      />
      <h1 class="text-2xl font-bold">{{ t('sessions.detail') }}</h1>
    </div>

    <div v-if="status === 'pending'" class="flex flex-col gap-4">
      <USkeleton class="h-24" />
      <USkeleton class="h-64" />
    </div>

    <template v-else-if="session">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatsKpiCard
          :label="t('sessions.project')"
          :value="session.project"
          icon="i-lucide-folder"
        />
        <StatsKpiCard
          :label="t('sessions.model')"
          :value="shortModelName(session.model)"
          icon="i-lucide-cpu"
        />
        <StatsKpiCard
          :label="t('sessions.messages')"
          :value="session.messageCount.toLocaleString()"
          icon="i-lucide-message-circle"
        />
        <StatsKpiCard
          :label="t('sessions.cost')"
          :value="formatCost(session.totalCost)"
          icon="i-lucide-dollar-sign"
        />
        <StatsKpiCard
          :label="t('sessions.duration')"
          :value="formatDuration(session.duration)"
          icon="i-lucide-clock"
        />
        <StatsKpiCard
          :label="t('sessions.date')"
          :value="formatDate(session.startTime)"
          icon="i-lucide-calendar"
        />
      </div>

      <UCard>
        <template #header>
          <h3 class="text-base font-semibold">Token Usage per Turn</h3>
        </template>

        <div class="divide-y divide-default">
          <div
            v-for="(msg, i) in assistantMessages"
            :key="i"
            class="flex items-center justify-between gap-4 py-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UBadge variant="subtle" size="sm">
                {{ shortModelName(msg.model ?? '') }}
              </UBadge>
              <span class="text-sm text-muted truncate">
                {{ msg.timestamp ? formatDateTime(msg.timestamp) : '-' }}
              </span>
            </div>
            <div class="flex items-center gap-4 shrink-0 text-sm">
              <span :title="t('common.input')">
                <UIcon name="i-lucide-arrow-down" class="size-3.5 text-blue-500" />
                {{ formatTokens(msg.inputTokens ?? 0) }}
              </span>
              <span :title="t('common.output')">
                <UIcon name="i-lucide-arrow-up" class="size-3.5 text-purple-500" />
                {{ formatTokens(msg.outputTokens ?? 0) }}
              </span>
              <span :title="t('common.cacheRead')">
                <UIcon name="i-lucide-database" class="size-3.5 text-green-500" />
                {{ formatTokens(msg.cacheReadTokens ?? 0) }}
              </span>
              <span class="font-medium">{{ formatCost(msg.cost ?? 0) }}</span>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
