import { generateSkill, generateAgent, createHook } from '~~/server/utils/claudeGenerate'
import { createJob, completeJob, failJob } from '~~/server/utils/generateBus'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { type, prompt } = body

  const jobId = crypto.randomUUID()
  createJob(jobId)

  if (type === 'hook') {
    createHook(prompt)
      .then(() => completeJob(jobId, null))
      .catch((err) => failJob(jobId, err instanceof Error ? err.message : 'Generation failed'))
  } else {
    const generateFn = type === 'skill' ? generateSkill : type === 'agent' ? generateAgent : null

    if (!generateFn) {
      failJob(jobId, `Unknown type: ${type}`)
      return { jobId }
    }

    generateFn(prompt)
      .then((result) => completeJob(jobId, result))
      .catch((err) => failJob(jobId, err instanceof Error ? err.message : 'Generation failed'))
  }

  return { jobId }
})
