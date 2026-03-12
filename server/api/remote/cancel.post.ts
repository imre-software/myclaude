export default defineEventHandler(() => {
  cancelPending()
  const killed = killAllExecutors()
  return { ok: true, killedProcesses: killed }
})
