import { makeWASocket, Browsers, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import type { WAVersion } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import type { WhatsAppConnectionStatus, WhatsAppStatus, WhatsAppEvent } from '~~/app/types/whatsapp'
import type { BusEvent } from './notificationBus'

type WASocket = ReturnType<typeof makeWASocket>

// Track outgoing message IDs to skip them in messages.upsert
const sentMessageIds = new Set<string>()

let cachedVersion: WAVersion | null = null

async function getWaVersion(): Promise<WAVersion> {
  if (cachedVersion) return cachedVersion

  try {
    const res = await fetch('https://web.whatsapp.com/sw.js')
    const text = await res.text()
    const match = text.match(/\??"client_revision\??":\s*(\d+)/)
    if (match?.[1]) {
      cachedVersion = [2, 3000, +match[1]]
      return cachedVersion
    }
  } catch {
    // Fall through to Baileys fallback
  }

  try {
    const { version } = await fetchLatestBaileysVersion()
    cachedVersion = version
    return cachedVersion
  } catch {
    return [2, 3000, 1034074495]
  }
}

let sock: WASocket | null = null
let connectionStatus: WhatsAppConnectionStatus = 'disconnected'
let busUnsubscribe: (() => void) | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let consecutiveFailures = 0
const MAX_FAILURES_BEFORE_CLEAR = 3

// Internal event bus for SSE consumers
const waListeners = new Set<(event: WhatsAppEvent) => void>()

export function onWhatsAppEvent(listener: (event: WhatsAppEvent) => void): () => void {
  waListeners.add(listener)
  return () => waListeners.delete(listener)
}

function pushEvent(event: WhatsAppEvent): void {
  for (const listener of waListeners) {
    listener(event)
  }
}

function setStatus(status: WhatsAppConnectionStatus): void {
  connectionStatus = status
  pushEvent({ type: 'status', connection: status })
}

function clearReconnectTimer(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
}

function scheduleReconnect(): void {
  clearReconnectTimer()
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 60_000)
  reconnectAttempts++
  reconnectTimeout = setTimeout(() => {
    connectWhatsApp()
  }, delay)
}

async function flushQueue(): Promise<void> {
  if (!sock || connectionStatus !== 'connected') return

  expireStaleMessages()
  const messages = getPendingMessages()
  for (const msg of messages) {
    try {
      const jid = msg.recipient.replace('+', '') + '@s.whatsapp.net'
      const result = await sock.sendMessage(jid, { text: msg.body })
      if (result?.key?.id) sentMessageIds.add(result.key.id)
      markSent(msg.id)
    } catch {
      markFailed(msg.id)
    }
  }
}

function registerBusListener(): void {
  if (busUnsubscribe) return

  busUnsubscribe = onNotificationEvent((event: BusEvent) => {
    if (event.type === 'usage-update') return

    const settings = getNotificationSettings()
    if (!settings.whatsapp.enabled || !settings.whatsapp.phoneNumber) return

    // Check quiet hours
    if (settings.quietHours.enabled) {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const { start, end } = settings.quietHours
      if (start <= end) {
        if (hhmm >= start && hhmm < end) return
      } else {
        if (hhmm >= start || hhmm < end) return
      }
    }

    const text = formatWhatsAppMessage(event)
    sendWhatsAppMessage(settings.whatsapp.phoneNumber, text)
  })
}

function unregisterBusListener(): void {
  if (busUnsubscribe) {
    busUnsubscribe()
    busUnsubscribe = null
  }
}

export async function connectWhatsApp(): Promise<void> {
  if (connectionStatus === 'connected' || connectionStatus === 'connecting') return

  setStatus('connecting')

  try {
    const version = await getWaVersion()
    console.log('[whatsapp] connecting with version', version.join('.'))

    const { state, saveCreds } = useSQLiteAuthState()

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys),
      },
      printQRInTerminal: false,
      browser: Browsers.macOS('Claude Command'),
      keepAliveIntervalMs: 30_000,
      retryRequestDelayMs: 350,
      connectTimeoutMs: 30_000,
      qrTimeout: 45_000,
      fireInitQueries: true,
      markOnlineOnConnect: false,
      emitOwnEvents: false,
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 })
          setStatus('qr-ready')
          pushEvent({ type: 'qr', qr: dataUrl })
        } catch {
          pushEvent({ type: 'error', message: 'Failed to generate QR code' })
        }
      }

      if (connection === 'open') {
        reconnectAttempts = 0
        consecutiveFailures = 0
        setStatus('connected')
        pushEvent({ type: 'connected' })
        registerBusListener()
        flushQueue()
      }

      if (connection === 'close') {
        sock = null
        unregisterBusListener()

        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
        const errorMsg = (lastDisconnect?.error as { message?: string })?.message
        if (import.meta.dev && errorMsg) {
          console.error('[whatsapp] connection closed:', errorMsg)
        }
        if (statusCode === DisconnectReason.loggedOut) {
          clearAuthState()
          consecutiveFailures = 0
          setStatus('logged-out')
        } else {
          consecutiveFailures++
          if (consecutiveFailures >= MAX_FAILURES_BEFORE_CLEAR) {
            console.warn(`[whatsapp] ${consecutiveFailures} consecutive failures - clearing stale auth`)
            clearAuthState()
            consecutiveFailures = 0
            setStatus('disconnected')
          } else {
            setStatus('disconnected')
            scheduleReconnect()
          }
        }
      }
    })

    sock.ev.on('messages.upsert', ({ messages: msgs }) => {
      const settings = getNotificationSettings()
      if (!settings.remoteMode?.enabled || !settings.remoteMode.channels.whatsapp) return

      for (const msg of msgs) {
        if (!msg.message) continue

        // Only accept messages from the self-chat (our own number)
        // WhatsApp may use classic JID (@s.whatsapp.net) or LID format (@lid)
        // For self-chat, accept both: fromMe messages to own JID, or LID-based self-chat
        const senderJid = msg.key.remoteJid
        if (!senderJid || !settings.whatsapp.phoneNumber) continue
        const expectedJid = settings.whatsapp.phoneNumber.replace('+', '') + '@s.whatsapp.net'
        const isSelfJid = senderJid === expectedJid
        const isLidSelfChat = senderJid.endsWith('@lid')
        if (!isSelfJid && !isLidSelfChat) {
          console.log('[whatsapp-chat] skipping message from', senderJid)
          continue
        }

        // Skip our own outgoing messages (sent via sendMessage)
        if (msg.key.id && sentMessageIds.has(msg.key.id)) {
          sentMessageIds.delete(msg.key.id)
          console.log('[whatsapp-chat] skipping own outgoing message', msg.key.id)
          continue
        }

        // Extract text from either extendedTextMessage or conversation
        const extendedText = msg.message.extendedTextMessage
        const contextInfo = extendedText?.contextInfo
        const quotedMessageId = contextInfo?.stanzaId
        const text = extendedText?.text ?? msg.message.conversation

        console.log('[whatsapp-chat] incoming:', { text, fromMe: msg.key.fromMe, quotedMessageId, msgId: msg.key.id })

        if (!text) continue

        // "kill" from any context cancels all pending hooks + executors
        if (text.trim().toLowerCase() === 'kill') {
          cancelPending()
          killAllExecutors()
          sendWhatsAppMessage(settings.whatsapp.phoneNumber, 'All pending tasks and processes killed.')
          continue
        }

        if (quotedMessageId) {
          // Try hook-reply flow first; if no pending hook matches, fall through to chat
          const delivered = deliverReply(text, quotedMessageId)
          if (!delivered) {
            handleWhatsAppChatMessage(settings.whatsapp.phoneNumber, text)
          }
        } else {
          // New message (not a reply) - route to chat flow
          handleWhatsAppChatMessage(settings.whatsapp.phoneNumber, text)
        }
      }
    })

    sock.ev.on('creds.update', () => {
      saveCreds()
    })
  } catch (err) {
    console.error('[whatsapp] failed to create socket:', err)
    sock = null
    setStatus('disconnected')
    pushEvent({ type: 'error', message: String(err) })
  }
}

export function disconnectWhatsApp(clearAuth = false): void {
  clearReconnectTimer()
  reconnectAttempts = 0
  unregisterBusListener()

  if (sock) {
    sock.end(undefined)
    sock = null
  }

  if (clearAuth) {
    clearAuthState()
  }

  setStatus('disconnected')
}

export function getWhatsAppStatus(): WhatsAppStatus {
  const settings = getNotificationSettings()
  return {
    connection: connectionStatus,
    phoneNumber: settings.whatsapp.phoneNumber,
    queueStats: getQueueStats(),
  }
}

export async function sendWhatsAppMessage(recipient: string, text: string): Promise<boolean> {
  if (!sock || connectionStatus !== 'connected') {
    enqueueMessage(recipient, text)
    return false
  }

  try {
    const jid = recipient.replace('+', '') + '@s.whatsapp.net'
    const result = await sock.sendMessage(jid, { text })
    if (result?.key?.id) sentMessageIds.add(result.key.id)
    return true
  } catch {
    enqueueMessage(recipient, text)
    return false
  }
}

export async function sendWhatsAppMessageForRemote(recipient: string, text: string): Promise<string | null> {
  if (!sock || connectionStatus !== 'connected') return null

  try {
    const jid = recipient.replace('+', '') + '@s.whatsapp.net'
    const result = await sock.sendMessage(jid, { text })
    if (result?.key?.id) sentMessageIds.add(result.key.id)
    return result?.key?.id ?? null
  } catch {
    return null
  }
}

export function tryAutoReconnect(): void {
  if (connectionStatus !== 'disconnected') return
  if (hasAuthState()) {
    connectWhatsApp()
  }
}

async function handleWhatsAppChatMessage(phoneNumber: string, text: string): Promise<void> {
  try {
    const action = await handleChatMessage('whatsapp', text)
    if (!action) return // message ignored (no "claude" keyword while idle)
    const response = formatChatActionWhatsApp(action)
    await sendWhatsAppMessage(phoneNumber, response)
  } catch (err) {
    if (import.meta.dev) console.error('[whatsapp] chat message error:', err)
    await sendWhatsAppMessage(phoneNumber, 'An error occurred processing your message.')
  }
}
