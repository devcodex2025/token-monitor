import { Bot } from 'grammy'

/**
 * Telegram bot (PRD FR-C3 / FR-F3): renew reminders, alerts and branded Boost messages.
 * Feature wiring lands in M2/M4; factory scaffolded in M0.1.
 */
export function createBot(token: string): Bot {
  return new Bot(token)
}
