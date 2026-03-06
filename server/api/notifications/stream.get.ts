export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const writer = event.node.res

  // Initial heartbeat so client knows the connection is alive
  writer.write(':\n\n')

  const unsubscribe = onNotificationEvent((notification) => {
    writer.write(`data: ${JSON.stringify(notification)}\n\n`)
  })

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    writer.write(':\n\n')
  }, 30_000)

  event.node.req.on('close', () => {
    unsubscribe()
    clearInterval(heartbeat)
  })

  // Keep the connection open
  event._handled = true
})
