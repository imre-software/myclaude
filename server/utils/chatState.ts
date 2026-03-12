import type { ChatChannel, ChatFlowContext, ChatAction } from '~~/app/types/remote'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

const states = new Map<ChatChannel, ChatFlowContext>()
const executionLocks = new Map<ChatChannel, boolean>()

function getContext(channel: ChatChannel): ChatFlowContext {
  let ctx = states.get(channel)
  if (!ctx) {
    ctx = {
      state: 'idle',
      sessions: [],
      selectedSession: null,
      lastActivity: Date.now(),
    }
    states.set(channel, ctx)
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

function resetContext(channel: ChatChannel): void {
  states.set(channel, {
    state: 'idle',
    sessions: [],
    selectedSession: null,
    lastActivity: Date.now(),
  })
}

const CANCEL_COMMANDS = new Set(['cancel', 'exit', 'quit'])
const BACK_COMMANDS = new Set(['back', 'sessions', 'list'])

export async function handleChatMessage(channel: ChatChannel, text: string): Promise<ChatAction> {
  const normalized = text.trim().toLowerCase()

  // "kill" cancels all pending hook requests and running executors
  if (normalized === 'kill') {
    cancelPending()
    killAllExecutors()
    resetContext(channel)
    return { type: 'reset' }
  }

  // Global cancel from any state
  if (CANCEL_COMMANDS.has(normalized)) {
    resetContext(channel)
    return { type: 'reset' }
  }

  // Check execution lock
  if (executionLocks.get(channel)) {
    return { type: 'still-processing' }
  }

  const ctx = getContext(channel)

  if (ctx.state === 'idle') {
    return await handleIdle(channel, ctx)
  }

  if (ctx.state === 'selecting') {
    return handleSelection(channel, ctx, normalized)
  }

  if (ctx.state === 'chatting') {
    // "back" returns to session list
    if (BACK_COMMANDS.has(normalized)) {
      return await handleIdle(channel, ctx)
    }
    return await handleChat(channel, ctx, text)
  }

  return { type: 'reset' }
}

async function handleIdle(channel: ChatChannel, ctx: ChatFlowContext): Promise<ChatAction> {
  const sessions = await discoverClaudeSessions()

  if (sessions.length === 0) {
    resetContext(channel)
    return { type: 'no-sessions' }
  }

  // Auto-select if only one session
  if (sessions.length === 1) {
    const session = sessions[0]!
    ctx.state = 'chatting'
    ctx.selectedSession = session
    ctx.sessions = sessions
    return { type: 'session-selected', session }
  }

  ctx.state = 'selecting'
  ctx.sessions = sessions
  return { type: 'session-list', sessions }
}

function handleSelection(_channel: ChatChannel, ctx: ChatFlowContext, text: string): ChatAction {
  const num = parseInt(text, 10)

  if (isNaN(num) || num < 1 || num > ctx.sessions.length) {
    return { type: 'invalid-selection', max: ctx.sessions.length }
  }

  const session = ctx.sessions[num - 1]!
  ctx.state = 'chatting'
  ctx.selectedSession = session
  return { type: 'session-selected', session }
}

async function handleChat(channel: ChatChannel, ctx: ChatFlowContext, message: string): Promise<ChatAction> {
  if (!ctx.selectedSession) {
    resetContext(channel)
    return { type: 'reset' }
  }

  executionLocks.set(channel, true)

  try {
    const response = await executeInSession(ctx.selectedSession.cwd, message)
    return {
      type: 'chat-response',
      response,
      project: ctx.selectedSession.project,
    }
  } catch (err) {
    return {
      type: 'chat-error',
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    executionLocks.set(channel, false)
  }
}
