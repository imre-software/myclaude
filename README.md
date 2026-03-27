# My Claude

Desktop companion app for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Track usage, monitor rate limits, control sessions remotely, and manage all Claude Code settings through a GUI - no JSON editing required.

## Features

- **Usage Dashboard** - tokens, costs, sessions, and activity heatmaps across all Claude Code projects
- **Rate Limit Monitoring** - real-time utilization gauges with pace alerts that predict exhaustion before reset
- **Cost Analysis** - cost breakdown by model, cache savings, token distribution charts
- **Remote Control** - control Claude Code sessions from your phone via WhatsApp or Telegram with approval notifications
- **Settings UI** - manage permissions, hooks, agents, skills, MCP servers, memory, and model selection
- **Session Explorer** - detailed session history with filtering and per-session stats
- **Project Breakdown** - per-project usage and cost stats
- **Period Comparison** - compare usage across time periods
- **System Tray** - runs in background with close-to-tray, quick stats in tray menu
- **Native Notifications** - threshold and pace alerts via macOS Notification Center / Windows notifications
- **Auto Updates** - built-in updater checks for new releases

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Nuxt 4 (SPA mode), Vue 3, Nuxt UI, Pinia |
| Backend | Nitro server, SQLite (better-sqlite3) |
| Desktop | Tauri v2 (Rust) |
| Messaging | WhatsApp (Baileys), Telegram Bot API |
| Charts | nuxt-charts |
| i18n | @nuxtjs/i18n |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## Getting Started

```bash
# Install dependencies
pnpm install

# Run as desktop app (Tauri + Nuxt)
pnpm tauri:dev

# Or run the web UI only
pnpm dev
```

The app runs on `http://localhost:3019`.

## Building

```bash
# Build the desktop app
pnpm tauri:build
```

This produces platform-specific installers in `src-tauri/target/release/bundle/`.

## Project Structure

```
app/                  # Nuxt frontend
  pages/              # Dashboard, usage, costs, sessions, projects, compare, monitoring, settings
  components/         # UI components
  stores/             # Pinia stores
  composables/        # Vue composables
  locales/            # i18n translations
server/               # Nitro backend
  api/                # API endpoints (stats, settings, notifications, messaging, remote)
  utils/              # Server utilities (DB, config, pace calculator)
  tasks/              # Cron tasks (threshold/pace checks)
src-tauri/            # Tauri desktop shell (Rust)
  src/                # Native code (notifications, tray, keychain)
```

## Security

My Claude is local-first:

- All data stays on your machine in a local SQLite database
- OAuth token is read from your OS keychain (macOS Keychain, Windows Credential Manager)
- The only external API calls are to Anthropic (for usage data) and your chosen messaging platform (WhatsApp/Telegram)
- WhatsApp and Telegram connections are direct - no third-party relay servers
- No telemetry, no analytics, no cloud sync

## License

[MIT](LICENSE) - Imre Ltd
