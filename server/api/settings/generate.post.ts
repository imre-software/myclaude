import { generateSkill, generateAgent, generateHook } from '~~/server/utils/claudeGenerate'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { type, prompt } = body

  switch (type) {
    case 'skill':
      return generateSkill(prompt)
    case 'agent':
      return generateAgent(prompt)
    case 'hook':
      return generateHook(prompt)
    default:
      throw createError({ statusCode: 400, message: `Unknown type: ${type}` })
  }
})
