export default defineNitroPlugin(() => {
  tryAutoReconnect()
  tryTelegramAutoConnect()
})
