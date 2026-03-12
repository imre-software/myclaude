import { readFileSync } from 'node:fs'

export function extractLastAssistantText(transcriptPath: string): string {
  try {
    const raw = readFileSync(transcriptPath, 'utf-8')
    const lines = raw.trim().split('\n')

    // Iterate backward to find last assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!.trim()
      if (!line) continue

      try {
        const entry = JSON.parse(line)
        if (entry.type !== 'assistant') continue

        // Extract text blocks from message content
        const content = entry.message?.content
        if (!Array.isArray(content)) continue

        const texts: string[] = []
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            texts.push(block.text)
          }
        }

        if (texts.length === 0) continue

        const full = texts.join('\n')
        // Truncate to ~500 chars
        if (full.length > 500) {
          return full.slice(0, 497) + '...'
        }
        return full
      } catch {
        // Skip unparseable lines
      }
    }

    return '(No assistant message found in transcript)'
  } catch {
    return '(Could not read transcript)'
  }
}
