export interface TelegramStatus {
  connected: boolean
  botName: string
  chatId: string
}

export interface TelegramBotInfo {
  id: number
  first_name: string
  username: string
}
