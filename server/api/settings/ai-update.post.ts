export default defineEventHandler(async (event) => {
  const { content, prompt } = await readBody<{ content: string, prompt: string }>(event)

  if (!content || !prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Missing content or prompt' })
  }

  const updated = await updateWithAi(content, prompt)
  return { content: updated }
})
