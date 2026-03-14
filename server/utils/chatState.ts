import { basename } from 'node:path'
import type { ChatChannel, ChatFlowContext, ChatAction, ActiveClaudeSession } from '~~/app/types/remote'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

// Keyed by chat identifier: 'telegram:12345', 'whatsapp:972501234@s.whatsapp.net', etc.
const states = new Map<string, ChatFlowContext>()

function getContext(chatId: string): ChatFlowContext {
  let ctx = states.get(chatId)
  if (!ctx) {
    ctx = {
      state: 'idle',
      sessions: [],
      selectedSession: null,
      lastActivity: Date.now(),
    }
    states.set(chatId, ctx)
  }

  // Auto-reset on inactivity
  if (Date.now() - ctx.lastActivity > INACTIVITY_TIMEOUT) {
    ctx.state = 'idle'
    ctx.sessions = []
    ctx.selectedSession = null
  }

  ctx.lastActivity = Date.now()
  return ctx
}

function resetContext(chatId: string): void {
  states.set(chatId, {
    state: 'idle',
    sessions: [],
    selectedSession: null,
    lastActivity: Date.now(),
  })
}

const CANCEL_COMMANDS = new Set(['cancel', 'exit', 'quit'])
const BACK_COMMANDS = new Set(['back', 'sessions', 'list'])

export async function handleChatMessage(
  channel: ChatChannel,
  chatId: string,
  text: string,
  routedProject?: string,
): Promise<ChatAction | null> {
  const normalized = text.trim().toLowerCase()
  const stateKey = `${channel}:${chatId}`

  // "kill" cancels all pending hook requests and running executors
  if (normalized === 'kill') {
    cancelPending()
    killAllExecutors()
    resetContext(stateKey)
    return { type: 'reset' }
  }

  // Global cancel from any state
  if (CANCEL_COMMANDS.has(normalized)) {
    killAllExecutors()
    resetContext(stateKey)
    return { type: 'reset' }
  }

  const ctx = getContext(stateKey)

  if (ctx.state === 'idle') {
    // Only activate when message contains "claude"
    if (!normalized.includes('claude')) {
      return null
    }
    return await handleIdle(stateKey, ctx, routedProject)
  }

  if (ctx.state === 'selecting') {
    return await handleSelection(stateKey, ctx, normalized)
  }

  if (ctx.state === 'chatting') {
    // "back" returns to session list, kills any running process
    if (BACK_COMMANDS.has(normalized)) {
      killAllExecutors()
      return await handleIdle(stateKey, ctx, routedProject)
    }
    // In chatting state, everything is handled by hooks (user swipe-replies to Claude's messages)
    return { type: 'chatting-hint' }
  }

  return { type: 'reset' }
}

async function handleIdle(stateKey: string, ctx: ChatFlowContext, routedProject?: string): Promise<ChatAction> {
  let sessions = await discoverClaudeSessions()

  // If from a routed group, only show sessions for that project
  if (routedProject) {
    sessions = sessions.filter(s => basename(s.cwd) === routedProject)
  }

  if (sessions.length === 0) {
    resetContext(stateKey)
    return { type: 'no-sessions' }
  }

  // Auto-select if only one session
  if (sessions.length === 1) {
    const session = sessions[0]!
    ctx.state = 'chatting'
    ctx.selectedSession = session
    ctx.sessions = sessions
    return spawnAndReturn(stateKey, session)
  }

  ctx.state = 'selecting'
  ctx.sessions = sessions
  return { type: 'session-list', sessions }
}

async function handleSelection(stateKey: string, ctx: ChatFlowContext, text: string): Promise<ChatAction> {
  const num = parseInt(text, 10)

  if (isNaN(num) || num < 1 || num > ctx.sessions.length) {
    return { type: 'invalid-selection', max: ctx.sessions.length }
  }

  const session = ctx.sessions[num - 1]!
  ctx.state = 'chatting'
  ctx.selectedSession = session
  return spawnAndReturn(stateKey, session)
}

function spawnAndReturn(stateKey: string, session: ActiveClaudeSession): ChatAction {
  const { onExit } = spawnChatSession(
    session.cwd,
    'User connected via WhatsApp/Telegram remote. Summarize what you\'ve been working on briefly.',
  )

  // When the spawned process exits, reset chat state
  onExit.then(() => {
    const current = states.get(stateKey)
    if (current?.selectedSession?.cwd === session.cwd) {
      resetContext(stateKey)
    }
  })

  return { type: 'session-selected', session }
}
