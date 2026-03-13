import type { ChatChannel, ChatFlowContext, ChatAction, ActiveClaudeSession } from '~~/app/types/remote'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

const states = new Map<ChatChannel, ChatFlowContext>()

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

export async function handleChatMessage(channel: ChatChannel, text: string): Promise<ChatAction | null> {
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
    killAllExecutors()
    resetContext(channel)
    return { type: 'reset' }
  }

  const ctx = getContext(channel)

  if (ctx.state === 'idle') {
    // Only activate when message contains "claude"
    if (!normalized.includes('claude')) {
      return null
    }
    return await handleIdle(channel, ctx)
  }

  if (ctx.state === 'selecting') {
    return await handleSelection(channel, ctx, normalized)
  }

  if (ctx.state === 'chatting') {
    // "back" returns to session list, kills any running process
    if (BACK_COMMANDS.has(normalized)) {
      killAllExecutors()
      return await handleIdle(channel, ctx)
    }
    // In chatting state, everything is handled by hooks (user swipe-replies to Claude's messages)
    return { type: 'chatting-hint' }
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
    return spawnAndReturn(channel, session)
  }

  ctx.state = 'selecting'
  ctx.sessions = sessions
  return { type: 'session-list', sessions }
}

async function handleSelection(_channel: ChatChannel, ctx: ChatFlowContext, text: string): Promise<ChatAction> {
  const num = parseInt(text, 10)

  if (isNaN(num) || num < 1 || num > ctx.sessions.length) {
    return { type: 'invalid-selection', max: ctx.sessions.length }
  }

  const session = ctx.sessions[num - 1]!
  ctx.state = 'chatting'
  ctx.selectedSession = session
  return spawnAndReturn(_channel, session)
}

function spawnAndReturn(channel: ChatChannel, session: ActiveClaudeSession): ChatAction {
  const { onExit } = spawnChatSession(
    session.cwd,
    'User connected via WhatsApp/Telegram remote. Summarize what you\'ve been working on briefly.',
  )

  // When the spawned process exits, reset chat state
  onExit.then(() => {
    const current = states.get(channel)
    if (current?.selectedSession?.cwd === session.cwd) {
      resetContext(channel)
    }
  })

  return { type: 'session-selected', session }
}
