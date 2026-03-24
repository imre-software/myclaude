import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { GenerateResponse } from '~~/app/types/settings'

function runClaude(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.HOME ? join(process.env.HOME, '.local', 'bin', 'claude') : 'claude',
      args,
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || `Process exited with code ${code}`))
      else resolve(stdout)
    })
  })
}

async function askClaude(prompt: string): Promise<string> {
  const stdout = await runClaude(['-p', '--output-format', 'json', prompt])
  try {
    const json = JSON.parse(stdout)
    return (json.result as string) ?? ''
  } catch {
    if (import.meta.dev) console.error('[claudeGenerate] Non-JSON output from claude:', stdout.slice(0, 200))
    return stdout.trim() || ''
  }
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

export async function updateWithAi(currentContent: string, userPrompt: string): Promise<string> {
  const prompt = `Here is existing content:

${currentContent}

---

Apply the following change: "${userPrompt}"

Output ONLY the complete updated content. No explanations, no markdown fences, just the content.`

  const content = await askClaude(prompt)
  const cleaned = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  return cleaned
}

export async function createHook(userPrompt: string): Promise<void> {
  await runClaude([
    '-p',
    '--permission-mode', 'bypassPermissions',
    '--max-turns', '10',
    '--system-prompt', `You are a Claude Code hook creator. The user will describe a hook they want.
You MUST create the hook exactly as requested. Do NOT question whether the hook is needed, do NOT suggest alternatives, do NOT refuse.
Your ONLY job is to implement the hook the user asked for. Create any shell scripts as needed and add the hook to ~/.claude/settings.json.`,
    userPrompt,
  ])
}
