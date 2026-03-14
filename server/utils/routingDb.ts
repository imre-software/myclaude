import type { ProjectRoutingRule } from '~~/app/types/remote'

interface RoutingRow {
  id: number
  project_name: string
  telegram_chat_id: string | null
  telegram_chat_title: string | null
  whatsapp_jid: string | null
  whatsapp_name: string | null
  whatsapp_picture_url: string | null
  enabled: number
  created_at: string
}

function rowToRule(row: RoutingRow): ProjectRoutingRule {
  return {
    id: row.id,
    projectName: row.project_name,
    telegramChatId: row.telegram_chat_id,
    telegramChatTitle: row.telegram_chat_title,
    whatsappJid: row.whatsapp_jid,
    whatsappName: row.whatsapp_name,
    whatsappPictureUrl: row.whatsapp_picture_url,
    enabled: !!row.enabled,
    createdAt: row.created_at,
  }
}

export function getRoutingRules(): ProjectRoutingRule[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM project_routing ORDER BY project_name').all() as RoutingRow[]
  return rows.map(rowToRule)
}

export function getRoutingForProject(projectName: string): ProjectRoutingRule | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM project_routing WHERE project_name = ? AND enabled = 1').get(projectName) as RoutingRow | undefined
  return row ? rowToRule(row) : null
}

export function getRoutingForTelegramChat(chatId: string): ProjectRoutingRule | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM project_routing WHERE telegram_chat_id = ? AND enabled = 1').get(chatId) as RoutingRow | undefined
  return row ? rowToRule(row) : null
}

export function getRoutingForWhatsAppJid(jid: string): ProjectRoutingRule | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM project_routing WHERE whatsapp_jid = ? AND enabled = 1').get(jid) as RoutingRow | undefined
  return row ? rowToRule(row) : null
}

export function upsertRoutingRule(rule: {
  projectName: string
  telegramChatId?: string | null
  telegramChatTitle?: string | null
  whatsappJid?: string | null
  whatsappName?: string | null
  whatsappPictureUrl?: string | null
  enabled?: boolean
}): ProjectRoutingRule {
  const db = getDb()
  db.prepare(`
    INSERT INTO project_routing (project_name, telegram_chat_id, telegram_chat_title, whatsapp_jid, whatsapp_name, whatsapp_picture_url, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_name) DO UPDATE SET
      telegram_chat_id = excluded.telegram_chat_id,
      telegram_chat_title = excluded.telegram_chat_title,
      whatsapp_jid = excluded.whatsapp_jid,
      whatsapp_name = excluded.whatsapp_name,
      whatsapp_picture_url = excluded.whatsapp_picture_url,
      enabled = excluded.enabled
  `).run(
    rule.projectName,
    rule.telegramChatId ?? null,
    rule.telegramChatTitle ?? null,
    rule.whatsappJid ?? null,
    rule.whatsappName ?? null,
    rule.whatsappPictureUrl ?? null,
    rule.enabled !== false ? 1 : 0,
  )

  return getRoutingForProject(rule.projectName) ?? getRoutingRules().find(r => r.projectName === rule.projectName)!
}

export function deleteRoutingRule(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM project_routing WHERE id = ?').run(id)
}

export function getAllRoutedTelegramChatIds(): Set<string> {
  const db = getDb()
  const rows = db.prepare('SELECT DISTINCT telegram_chat_id FROM project_routing WHERE telegram_chat_id IS NOT NULL AND enabled = 1').all() as Array<{ telegram_chat_id: string }>
  return new Set(rows.map(r => r.telegram_chat_id))
}

export function getAllRoutedWhatsAppJids(): Set<string> {
  const db = getDb()
  const rows = db.prepare('SELECT DISTINCT whatsapp_jid FROM project_routing WHERE whatsapp_jid IS NOT NULL AND enabled = 1').all() as Array<{ whatsapp_jid: string }>
  return new Set(rows.map(r => r.whatsapp_jid))
}
