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
    'nuxt-phone-input',
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

  build: {
    transpile: ['nuxt-phone-input'],
  },

  // Ensure Nuxt auto-imports (ref, computed, watch, etc.) are applied to
  // the linked nuxt-phone-input module's .vue files
  imports: {
    transform: {
      include: [/nuxt-phone-input/],
    },
  },

  // Ignore Tauri's Rust source
  ignore: ['**/src-tauri/**'],

  nitro: {
    output: {
      publicDir: '.output/server/public',
    },
    externals: {
      external: ['better-sqlite3', '@whiskeysockets/baileys'],
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '0 * * * *': ['notifications:check'],
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
