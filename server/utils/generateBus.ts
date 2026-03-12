import type { GenerateResponse } from '~~/app/types/settings'

interface GenerateJob {
  id: string
  status: 'generating' | 'done' | 'error'
  result?: GenerateResponse | null
  error?: string
}

type JobListener = (job: GenerateJob) => void

const jobs = new Map<string, GenerateJob>()
const listeners = new Map<string, Set<JobListener>>()

export function createJob(id: string): void {
  jobs.set(id, { id, status: 'generating' })
}

export function completeJob(id: string, result: GenerateResponse | null): void {
  const job: GenerateJob = { id, status: 'done', result }
  jobs.set(id, job)
  notifyListeners(id, job)
}

export function failJob(id: string, error: string): void {
  const job: GenerateJob = { id, status: 'error', error }
  jobs.set(id, job)
  notifyListeners(id, job)
}

export function getJob(id: string): GenerateJob | undefined {
  return jobs.get(id)
}

export function removeJob(id: string): void {
  jobs.delete(id)
  listeners.delete(id)
}

export function onJobUpdate(id: string, listener: JobListener): () => void {
  if (!listeners.has(id)) {
    listeners.set(id, new Set())
  }
  listeners.get(id)!.add(listener)
  return () => listeners.get(id)?.delete(listener)
}

function notifyListeners(id: string, job: GenerateJob): void {
  const jobListeners = listeners.get(id)
  if (jobListeners) {
    for (const listener of jobListeners) {
      listener(job)
    }
  }
}
