import { invoke } from '@tauri-apps/api/core'
import type {
  NotificationSettings,
  NotificationSettingsUpdate,
} from '~/types/notifications'
import type { WhatsAppStatus } from '~/types/whatsapp'
import type { TelegramStatus } from '~/types/telegram'
import { NOTIFICATION_DEFAULTS } from '~/types/notifications'

async function emitUsageToTray(data: { fiveHour: number | null, sevenDay: number | null, sevenDaySonnet: number | null }) {
  if (!(window as Record<string, unknown>).__TAURI_INTERNALS__) return
  try {
    await invoke('update_tray_usage', data)
  } catch {
    // Tauri not available
  }
}

export const useNotificationStore = defineStore('notifications', () => {
  const settings = ref<NotificationSettings>({ ...NOTIFICATION_DEFAULTS })
  const unreadCount = ref(0)
  const isTauriAvailable = ref(false)
  const permissionStatus = ref<'not-determined' | 'granted' | 'denied' | 'provisional' | 'unknown'>('not-determined')
  const whatsappStatus = ref<WhatsAppStatus>({
    connection: 'disconnected',
    phoneNumber: '',
    queueStats: { pending: 0, failed: 0 },
  })
  const telegramStatus = ref<TelegramStatus>({
    connected: false,
    botName: '',
    chatId: '',
  })
  let eventSource: EventSource | null = null

  function listenForTrayRefresh() {
    if (!isTauriAvailable.value) return
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('tray-refresh', () => {
        const usageStore = useUsageStore()
        usageStore.hardRefresh()
      })
    })
  }

  async function syncCloseToTray() {
    if (!isTauriAvailable.value) return
    try {
      await invoke('set_close_to_tray', { enabled: settings.value.closeToTray })
    } catch {
      // Tauri not available
    }
  }

  async function init() {
    try {
      settings.value = await $fetch<NotificationSettings>('/api/notifications/settings')
    } catch {
      settings.value = { ...NOTIFICATION_DEFAULTS }
    }

    isTauriAvailable.value = !!(window as Record<string, unknown>).__TAURI_INTERNALS__

    if (isTauriAvailable.value) {
      try {
        const status = await invoke<string>('check_notification_permission')
        permissionStatus.value = status as typeof permissionStatus.value

        if (permissionStatus.value === 'not-determined' && settings.value.enabled) {
          await requestPermission()
        }
      } catch {
        permissionStatus.value = 'unknown'
      }
    } else {
      permissionStatus.value = 'granted'
    }

    await syncCloseToTray()
    listenForTrayRefresh()
    await loadUnreadCount()
    connectSSE()
    await loadWhatsAppStatus()
    await loadTelegramStatus()
  }

  async function loadWhatsAppStatus() {
    try {
      whatsappStatus.value = await $fetch<WhatsAppStatus>('/api/whatsapp/status')
    } catch {
      // Keep default
    }
  }

  async function loadTelegramStatus() {
    try {
      telegramStatus.value = await $fetch<TelegramStatus>('/api/telegram/status')
    } catch {
      // Keep default
    }
  }

  function connectSSE() {
    if (eventSource) return

    eventSource = new EventSource('/api/notifications/stream')

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'usage-update') {
          await emitUsageToTray(data)
          return
        }
        await sendNativeNotification(data.title, data.body)
        unreadCount.value++
      } catch {
        // Malformed event
      }
    }

    eventSource.onerror = () => {
      // Reconnect after a delay
      eventSource?.close()
      eventSource = null
      setTimeout(connectSSE, 5_000)
    }
  }

  async function requestPermission(): Promise<boolean> {
    if (!isTauriAvailable.value) return true

    try {
      const granted = await invoke<boolean>('request_notification_permission')
      permissionStatus.value = granted ? 'granted' : 'denied'
      return granted
    } catch {
      permissionStatus.value = 'unknown'
      return false
    }
  }

  async function sendNativeNotification(title: string, body: string, sound?: string) {
    const resolvedSound = sound ?? settings.value.sound
    if (isTauriAvailable.value) {
      await invoke('send_notification', { title, body, sound: resolvedSound })
    } else {
      await $fetch('/api/notifications/send', {
        method: 'POST',
        body: { title, body, sound: resolvedSound },
      })
    }
  }

  async function updateSettings(partial: NotificationSettingsUpdate) {
    settings.value = await $fetch<NotificationSettings>('/api/notifications/settings', {
      method: 'PUT',
      body: partial,
    })
    if ('closeToTray' in partial) {
      await syncCloseToTray()
    }
  }

  async function loadUnreadCount() {
    try {
      const history = await $fetch<Array<{ read: boolean }>>('/api/notifications/history?limit=100')
      unreadCount.value = history.filter(n => !n.read).length
    } catch {
      unreadCount.value = 0
    }
  }

  async function sendTestNotification(): Promise<{ ok: boolean, error?: string }> {
    try {
      await sendNativeNotification('Test Notification', 'Notifications are working correctly.')
      return { ok: true }
    } catch (err) {
      if (import.meta.dev) console.error('[notifications] test failed:', err)
      return { ok: false, error: String(err) }
    }
  }

  return {
    settings,
    unreadCount,
    permissionStatus,
    whatsappStatus,
    telegramStatus,
    init,
    requestPermission,
    updateSettings,
    loadUnreadCount,
    loadWhatsAppStatus,
    loadTelegramStatus,
    sendTestNotification,
  }
})
