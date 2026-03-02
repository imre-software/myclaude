<script setup lang="ts">
import { en } from '@nuxt/ui/locale'

const browserCode = import.meta.client ? navigator.language : 'en'

const locale = extendLocale(en, {
  code: browserCode,
})
</script>

<template>
  <UApp :locale="locale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
