// Nitro's file tracer (vercel/nft) copies only import-traced files, not full packages.
// This leaves some packages incomplete (e.g. protobufjs missing index.js).
// It also loses npm/pnpm package aliases (e.g. baileys uses "libsignal" -> @whiskeysockets/libsignal-node).
// This script fixes both issues after `pnpm build`.

import { readFileSync, cpSync, existsSync, rmSync, mkdirSync, realpathSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(import.meta.dirname, '..')
const serverModules = resolve(root, '.output/server/node_modules')
const serverPkg = JSON.parse(readFileSync(resolve(root, '.output/server/package.json'), 'utf8'))

// Two require contexts:
// 1. From the OUTPUT's baileys (for packages already in the output)
// 2. From the PROJECT's baileys real path (resolves pnpm symlinks so aliases like "libsignal" work)
const outputBaileysDir = resolve(serverModules, '@whiskeysockets/baileys')
const outputReq = createRequire(resolve(outputBaileysDir, 'package.json'))

const projectBaileysSymlink = resolve(root, 'node_modules/@whiskeysockets/baileys/package.json')
const projectReq = existsSync(projectBaileysSymlink)
  ? createRequire(realpathSync(projectBaileysSymlink))
  : outputReq

let fixed = 0

// 1. Fix incomplete packages (traced but missing entry files)
for (const name of Object.keys(serverPkg.dependencies)) {
  const destDir = resolve(serverModules, name)
  if (!existsSync(resolve(destDir, 'package.json'))) continue

  const destPkg = JSON.parse(readFileSync(resolve(destDir, 'package.json'), 'utf8'))
  const mainFile = destPkg.main || 'index.js'

  if (existsSync(resolve(destDir, mainFile))) continue

  for (const req of [outputReq, projectReq]) {
    try {
      const fullDir = dirname(req.resolve(`${name}/package.json`))
      rmSync(destDir, { recursive: true, force: true })
      cpSync(fullDir, destDir, { recursive: true })
      console.log(`Fixed incomplete: ${name} (was missing ${mainFile})`)
      fixed++
      break
    } catch {
      // Try next resolver
    }
  }
}

// 2. Fix missing aliased packages (baileys deps installed under different names)
const baileysPkg = JSON.parse(readFileSync(resolve(outputBaileysDir, 'package.json'), 'utf8'))
for (const alias of Object.keys(baileysPkg.dependencies || {})) {
  const aliasDir = resolve(serverModules, alias)
  if (existsSync(aliasDir)) continue

  // Resolve from project's baileys context (pnpm resolves aliases there)
  try {
    const fullDir = dirname(projectReq.resolve(`${alias}/package.json`))
    mkdirSync(dirname(aliasDir), { recursive: true })
    cpSync(fullDir, aliasDir, { recursive: true })
    console.log(`Fixed alias: ${alias}`)
    fixed++
  } catch {
    // Not resolvable, skip
  }
}

console.log(fixed ? `Fixed ${fixed} packages` : 'All packages OK')
