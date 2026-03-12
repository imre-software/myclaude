import { getJob, onJobUpdate, removeJob } from '~~/server/utils/generateBus'

export default defineEventHandler((event) => {
  const { jobId } = getQuery(event)

  if (!jobId || typeof jobId !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing jobId' })
  }

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const writer = event.node.res

  // Check if job already completed before SSE connected
  const job = getJob(jobId)
  if (job && job.status !== 'generating') {
    writer.write(`data: ${JSON.stringify(job)}\n\n`)
    writer.end()
    removeJob(jobId)
    event._handled = true
    return
  }

  if (!job) {
    writer.write(`data: ${JSON.stringify({ id: jobId, status: 'error', error: 'Job not found' })}\n\n`)
    writer.end()
    event._handled = true
    return
  }

  // Job is still generating - listen for updates
  writer.write(':\n\n')

  const heartbeat = setInterval(() => {
    writer.write(':\n\n')
  }, 15_000)

  const unsubscribe = onJobUpdate(jobId, (updatedJob) => {
    writer.write(`data: ${JSON.stringify(updatedJob)}\n\n`)
    if (updatedJob.status !== 'generating') {
      cleanup()
      writer.end()
    }
  })

  function cleanup() {
    unsubscribe()
    clearInterval(heartbeat)
    removeJob(jobId)
  }

  event.node.req.on('close', cleanup)
  event._handled = true
})
