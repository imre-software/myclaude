<script setup lang="ts">
defineProps<{
  text: string
  warning?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p class="flex items-center gap-1.5 text-sm text-muted">
      <UIcon name="i-lucide-info" class="size-3.5 shrink-0" />
      {{ text }}
    </p>
    <p v-if="warning" class="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
      <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" />
      {{ warning }}
    </p>
  </div>
</template>
