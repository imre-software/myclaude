interface PendingRequest {
  sessionId: string
  hookEvent: string
  messageIds: {
    whatsapp?: string
    telegram?: number
  }
  resolve: (reply: string | null) => void
  timeout: ReturnType<typeof setTimeout>
  createdAt: number
}

let pending: PendingRequest | null = null

export function waitForReply(
  sessionId: string,
  hookEvent: string,
  messageIds: { whatsapp?: string, telegram?: number },
  timeoutMs: number,
): Promise<string | null> {
  // If there's already a pending request, resolve it with null (let Claude stop / deny)
  if (pending) {
    pending.resolve(null)
    clearTimeout(pending.timeout)
    pending = null
  }

  return new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => {
      if (pending?.sessionId === sessionId) {
        pending = null
      }
      resolve(null)
    }, timeoutMs)

    pending = {
      sessionId,
      hookEvent,
      messageIds,
      resolve,
      timeout,
      createdAt: Date.now(),
    }
  })
}

export function deliverReply(message: string, sourceMessageId: string | number): boolean {
  if (!pending) return false

  // Check if the source message ID matches one of our stored sent message IDs
  const { messageIds } = pending
  const matches =
    (typeof sourceMessageId === 'string' && messageIds.whatsapp === sourceMessageId) ||
    (typeof sourceMessageId === 'number' && messageIds.telegram === sourceMessageId)

  if (!matches) return false

  clearTimeout(pending.timeout)
  const { resolve } = pending
  pending = null
  resolve(message)
  return true
}

export function getPending(): {
  sessionId: string
  hookEvent: string
  createdAt: number
} | null {
  if (!pending) return null
  return {
    sessionId: pending.sessionId,
    hookEvent: pending.hookEvent,
    createdAt: pending.createdAt,
  }
}

export function cancelPending(): void {
  if (!pending) return
  clearTimeout(pending.timeout)
  pending.resolve(null)
  pending = null
}
