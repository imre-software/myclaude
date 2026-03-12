import type { RemoteLogEntry } from '~~/app/types/remote'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 200)

  const db = getDb()
  const rows = db.prepare(`
    SELECT id, session_id as sessionId, hook_event as hookEvent,
           project, summary, user_reply as userReply, channel,
           created_at as createdAt, replied_at as repliedAt, status
    FROM remote_mode_log
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as RemoteLogEntry[]

  return rows
})
