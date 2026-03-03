import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { GenerateResponse } from '~~/app/types/settings'

function execWithClosedStdin(cmd: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
    child.stdin?.end()
  })
}

function getClaudePath(): string {
  return process.env.HOME
    ? join(process.env.HOME, '.local', 'bin', 'claude')
    : 'claude'
}

async function askClaude(prompt: string): Promise<string> {
  const stdout = await execWithClosedStdin(
    getClaudePath(),
    ['-p', '--output-format', 'json', prompt],
    60_000,
  )
  const json = JSON.parse(stdout)
  return (json.result as string) ?? ''
}

export async function generateSkill(userPrompt: string): Promise<GenerateResponse> {
  const prompt = `Generate a Claude Code SKILL.md file based on this description: "${userPrompt}"

Requirements:
- Output ONLY the complete SKILL.md content, nothing else
- Include proper YAML frontmatter with: name (lowercase, hyphens, max 64 chars), description, allowed-tools (comma-separated list of tools the skill needs)
- The name should be derived from the description
- The body should contain clear instructions for Claude to follow when the skill is invoked
- Use $ARGUMENTS placeholder if the skill accepts arguments

Example format:
---
name: example-skill
description: A brief description of what this skill does
allowed-tools: Bash, Read, Write, Grep, Glob
---

Instructions for Claude here...`

  const content = await askClaude(prompt)
  const cleaned = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()

  const nameMatch = cleaned.match(/^---\n[\s\S]*?name:\s*(.+)\n[\s\S]*?---/)
  const name = nameMatch?.[1]?.trim() ?? 'new-skill'

  return { content: cleaned, name, filename: name }
}

export async function generateAgent(userPrompt: string): Promise<GenerateResponse> {
  const prompt = `Generate a Claude Code custom agent definition (.md file) based on this description: "${userPrompt}"

Requirements:
- Output ONLY the complete agent .md file content, nothing else
- Include YAML frontmatter with: name (lowercase, hyphens), description (when Claude should delegate to this agent - include trigger conditions)
- Optionally include: model (sonnet/opus/haiku/inherit), tools (comma-separated allowlist), maxTurns
- The body should contain the system instructions for the agent

Example format:
---
name: example-agent
description: Expert at X. Use this agent when the user asks about Y or needs Z.
model: sonnet
---

You are an expert at...`

  const content = await askClaude(prompt)
  const cleaned = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()

  const nameMatch = cleaned.match(/^---\n[\s\S]*?name:\s*(.+)\n[\s\S]*?---/)
  const name = nameMatch?.[1]?.trim() ?? 'new-agent'

  return { content: cleaned, name, filename: `${name}.md` }
}

export async function generateHook(userPrompt: string): Promise<GenerateResponse> {
  const prompt = `Generate a Claude Code hook configuration based on this description: "${userPrompt}"

Requirements:
- Output ONLY valid JSON (no markdown, no explanation)
- The JSON should have this structure:
{
  "event": "PreToolUse|PostToolUse|Stop|SessionStart|etc",
  "matcher": "optional matcher pattern",
  "handlers": [
    {
      "type": "command",
      "command": "the shell command to run",
      "timeout": 600
    }
  ]
}

Available events: PreToolUse, PostToolUse, PostToolUseFailure, SessionStart, SessionEnd, UserPromptSubmit, Stop, Notification, SubagentStart, SubagentStop, PreCompact
Matcher is used with tool-related events to filter by tool name (supports regex).
If a shell script is needed, use an inline command or reference a script path.`

  const content = await askClaude(prompt)
  const cleaned = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()

  let name = 'new-hook'
  try {
    const parsed = JSON.parse(cleaned)
    name = `${parsed.event}${parsed.matcher ? `:${parsed.matcher}` : ''}`
  } catch {
    // name stays as default
  }

  return { content: cleaned, name, filename: name }
}
