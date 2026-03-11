import { proto, initAuthCreds, BufferJSON, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys'
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, SignalKeyStore } from '@whiskeysockets/baileys'

type SignalDataSet = { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } }

function fixKey(key: string): string {
  return key.replace(/\//g, '__').replace(/:/g, '-')
}

export function useSQLiteAuthState(): { state: AuthenticationState, saveCreds: () => void } {
  const db = getDb()

  const getRow = db.prepare('SELECT value FROM whatsapp_auth WHERE key = ?')
  const upsertRow = db.prepare(
    'INSERT INTO whatsapp_auth (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )
  const deleteRow = db.prepare('DELETE FROM whatsapp_auth WHERE key = ?')

  function readData(key: string): unknown | null {
    const row = getRow.get(fixKey(key)) as { value: string } | undefined
    if (!row) return null
    try {
      return JSON.parse(row.value, BufferJSON.reviver)
    } catch {
      return null
    }
  }

  function writeData(key: string, data: unknown): void {
    upsertRow.run(fixKey(key), JSON.stringify(data, BufferJSON.replacer))
  }

  function removeData(key: string): void {
    deleteRow.run(fixKey(key))
  }

  const creds: AuthenticationCreds = (readData('creds') as AuthenticationCreds) || initAuthCreds()

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data: { [id: string]: SignalDataTypeMap[T] } = {}
        for (const id of ids) {
          let value = readData(`${type}-${id}`)
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          }
          if (value) {
            data[id] = value as SignalDataTypeMap[T]
          }
        }
        return data
      },
      set: async (data: SignalDataSet) => {
        const upsertMany = db.transaction(() => {
          for (const category in data) {
            const entries = data[category as keyof SignalDataSet]
            if (!entries) continue
            for (const id in entries) {
              const value = entries[id]
              const key = `${category}-${id}`
              if (value) {
                writeData(key, value)
              } else {
                removeData(key)
              }
            }
          }
        })
        upsertMany()
      },
    },
  }

  function saveCreds(): void {
    writeData('creds', state.creds)
  }

  return { state, saveCreds }
}

export function clearAuthState(): void {
  const db = getDb()
  db.prepare('DELETE FROM whatsapp_auth').run()
}

export function hasAuthState(): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM whatsapp_auth WHERE key = ? LIMIT 1').get('creds') as { 1: number } | undefined
  return !!row
}
