interface QueuedMessage {
  id: number
  recipient: string
  body: string
}

export function enqueueMessage(recipient: string, body: string): void {
  const db = getDb()
  db.prepare(
    'INSERT INTO whatsapp_message_queue (recipient, body) VALUES (?, ?)',
  ).run(recipient, body)
}

export function getPendingMessages(): QueuedMessage[] {
  const db = getDb()
  return db.prepare(
    'SELECT id, recipient, body FROM whatsapp_message_queue WHERE status = ? AND attempts < 5',
  ).all('pending') as QueuedMessage[]
}

export function markSent(id: number): void {
  const db = getDb()
  db.prepare(
    'UPDATE whatsapp_message_queue SET status = ?, last_attempt_at = datetime(\'now\', \'localtime\') WHERE id = ?',
  ).run('sent', id)
}

export function markFailed(id: number): void {
  const db = getDb()
  db.prepare(
    'UPDATE whatsapp_message_queue SET attempts = attempts + 1, last_attempt_at = datetime(\'now\', \'localtime\') WHERE id = ?',
  ).run(id)
}

export function expireStaleMessages(): void {
  const db = getDb()
  db.prepare(
    'UPDATE whatsapp_message_queue SET status = ? WHERE status = ? AND created_at < datetime(\'now\', \'localtime\', \'-24 hours\')',
  ).run('expired', 'pending')
}

export function getQueueStats(): { pending: number, failed: number } {
  const db = getDb()
  const rows = db.prepare(
    'SELECT status, COUNT(*) as count FROM whatsapp_message_queue WHERE status IN (?, ?) GROUP BY status',
  ).all('pending', 'failed') as Array<{ status: string, count: number }>

  const stats = { pending: 0, failed: 0 }
  for (const row of rows) {
    if (row.status === 'pending') stats.pending = row.count
    if (row.status === 'failed') stats.failed = row.count
  }
  return stats
}
