// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    anthropicAdminKey: '',
  },

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    'nuxt-charts',
    '@nuxtjs/i18n',
  ],

  i18n: {
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json' },
    ],
    defaultLocale: 'en',
    restructureDir: 'app',
  },

  css: ['~/assets/css/main.css'],

  nitro: {
    externals: {
      external: ['better-sqlite3'],
    },
    typescript: {
      tsConfig: {
        compilerOptions: {
          types: ['node'],
        },
      },
    },
  },
})
