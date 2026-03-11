export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const writer = event.node.res

  writer.write(':\n\n')

  const unsubscribe = onWhatsAppEvent((waEvent) => {
    writer.write(`data: ${JSON.stringify(waEvent)}\n\n`)
  })

  const heartbeat = setInterval(() => {
    writer.write(':\n\n')
  }, 30_000)

  event.node.req.on('close', () => {
    unsubscribe()
    clearInterval(heartbeat)
  })

  event._handled = true
})
