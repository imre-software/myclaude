// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SPA mode for Tauri - Nitro still runs as a standalone server
  ssr: false,

  devServer: {
    port: 3019,
  },

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

  vite: {
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
    server: {
      strictPort: true,
    },
    optimizeDeps: {
      include: [
        '@nuxt/ui > prosemirror-state',
        '@nuxt/ui > prosemirror-transform',
        '@nuxt/ui > prosemirror-model',
        '@nuxt/ui > prosemirror-view',
        '@nuxt/ui > prosemirror-gapcursor',
      ],
    },
  },

  // Ignore Tauri's Rust source
  ignore: ['**/src-tauri/**'],

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
