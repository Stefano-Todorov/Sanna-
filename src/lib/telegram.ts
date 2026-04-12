import { Telegraf, Markup } from 'telegraf'

let bot: Telegraf | null = null

export function getTelegramBot(): Telegraf {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
    bot = new Telegraf(token)
  }
  return bot
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const tg = getTelegramBot()
  return tg.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' })
}

export async function sendTelegramMessageWithButtons(
  chatId: string,
  text: string,
  buttons: { label: string; callbackData: string }[]
) {
  const tg = getTelegramBot()
  const keyboard = Markup.inlineKeyboard(
    buttons.map(b => Markup.button.callback(b.label, b.callbackData))
  )
  return tg.telegram.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    ...keyboard,
  })
}
