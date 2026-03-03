import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { ContextBreakdown, ContextCategory, ContextItem } from '~~/app/types/usage'

function execWithClosedStdin(cmd: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
    child.stdin?.end()
  })
}

let cached: { data: ContextBreakdown, fetchedAt: number } | null = null
const CACHE_TTL = 300_000 // 5 min - context doesn't change between sessions

export function clearContextCache() {
  cached = null
}

export function getCachedContext(): ContextBreakdown | null {
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
    return cached.data
  }
  return null
}

function parseTokenValue(str: string): number {
  const trimmed = str.trim().replace(/,/g, '')
  if (trimmed.endsWith('k')) return Math.round(parseFloat(trimmed) * 1_000)
  if (trimmed.endsWith('M')) return Math.round(parseFloat(trimmed) * 1_000_000)
  return parseInt(trimmed, 10) || 0
}

function parseMarkdownTable(markdown: string, sectionHeader: string): string[][] {
  const headerIdx = markdown.indexOf(sectionHeader)
  if (headerIdx === -1) return []

  const afterHeader = markdown.slice(headerIdx + sectionHeader.length)
  const lines = afterHeader.split('\n')
  const rows: string[][] = []

  let foundHeader = false
  let foundSeparator = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) {
      if (foundSeparator) break
      continue
    }
    if (!foundHeader) { foundHeader = true; continue }
    if (trimmed.includes('---')) { foundSeparator = true; continue }
    if (!foundSeparator) continue

    const cells = trimmed.split('|').slice(1, -1).map(c => c.trim())
    if (cells.length > 0) rows.push(cells)
  }

  return rows
}

function parseItemsTable(markdown: string, sectionHeader: string, nameCol: number, tokensCol: number): ContextItem[] {
  const rows = parseMarkdownTable(markdown, sectionHeader)
  return rows.map(row => ({
    name: row[nameCol]?.trim() ?? '',
    tokens: parseTokenValue(row[tokensCol] ?? '0'),
  })).filter(item => item.name)
}

function parseContextMarkdown(md: string): ContextBreakdown {
  // Parse header: **Model:** claude-opus-4-6 and **Tokens:** 31.1k / 200k (16%)
  const modelMatch = md.match(/\*\*Model:\*\*\s*(\S+)/)
  const tokensMatch = md.match(/\*\*Tokens:\*\*\s*([\d.]+[kM]?)\s*\/\s*([\d.]+[kM]?)\s*\((\d+)%\)/)

  const model = modelMatch?.[1] ?? 'claude-opus-4-6'
  const usedTokens = tokensMatch ? parseTokenValue(tokensMatch[1]!) : 0
  const totalContextWindow = tokensMatch ? parseTokenValue(tokensMatch[2]!) : 200_000
  const usedPercentage = tokensMatch ? parseInt(tokensMatch[3]!, 10) : 0

  // Parse category table
  const catRows = parseMarkdownTable(md, '### Estimated usage by category')
  const allCategories: ContextCategory[] = catRows.map(row => ({
    label: row[0]?.trim() ?? '',
    slug: (row[0]?.trim() ?? '').toLowerCase().replace(/\s+/g, '-'),
    tokens: parseTokenValue(row[1] ?? '0'),
    percentage: parseFloat(row[2]?.replace('%', '') ?? '0') || 0,
    items: [],
  }))

  // Parse detail tables and attach items to matching categories
  const itemMap: Record<string, ContextItem[]> = {
    'mcp-tools': parseItemsTable(md, '### MCP Tools', 0, 2),
    'custom-agents': parseItemsTable(md, '### Custom Agents', 0, 2),
    'memory-files': parseItemsTable(md, '### Memory Files', 1, 2),
    'skills': parseItemsTable(md, '### Skills', 0, 2),
  }

  for (const cat of allCategories) {
    cat.items = itemMap[cat.slug] ?? []
  }

  // Extract free space and autocompact buffer (separate display)
  const freeSpaceCat = allCategories.find(c => c.slug === 'free-space')
  const autocompactCat = allCategories.find(c => c.slug === 'autocompact-buffer')

  // Display categories: everything except free space, autocompact, and messages
  const displayCategories = allCategories.filter(c =>
    c.slug !== 'free-space' && c.slug !== 'autocompact-buffer' && c.slug !== 'messages',
  )

  return {
    model,
    totalContextWindow,
    usedTokens,
    usedPercentage,
    categories: displayCategories,
    freeSpace: freeSpaceCat?.tokens ?? 0,
    freeSpacePercentage: freeSpaceCat?.percentage ?? 0,
    autocompactBuffer: autocompactCat?.tokens ?? 0,
    autocompactPercentage: autocompactCat?.percentage ?? 0,
  }
}

export async function probeContext(): Promise<ContextBreakdown | null> {
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
    return cached.data
  }

  try {
    const claudePath = process.env.HOME
      ? join(process.env.HOME, '.local', 'bin', 'claude')
      : 'claude'

    const stdout = await execWithClosedStdin(claudePath, [
      '-p', '--output-format', 'json', '/context',
    ], 30_000)

    const json = JSON.parse(stdout)
    const md: string = json.result ?? ''

    const result = parseContextMarkdown(md)
    cached = { data: result, fetchedAt: Date.now() }
    return result
  } catch (err: unknown) {
    if (import.meta.dev) {
      const e = err as { stderr?: string, code?: number }
      console.error('[contextProbe] failed:', e.stderr ?? err)
    }
    return null
  }
}
