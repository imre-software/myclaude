import { cpSync, rmSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, '.output', 'server')
const dest = resolve(root, 'src-tauri', 'server')

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
cpSync(source, dest, { recursive: true })

console.log('Copied .output/server -> src-tauri/server')
