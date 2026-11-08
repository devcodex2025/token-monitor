import type { TxEvent } from '@tmr/parser'
import type { Logger } from './types'
import { createHmac } from 'node:crypto'

export type DeliveryKind = 'tg' | 'webhook_out'

export interface DeliveryPayload {
  kind: DeliveryKind
  event: TxEvent
  text: string
  data: unknown
}

export interface DeliveryAdapter {
  send: (payload: DeliveryPayload) => Promise<void>
}

export interface FormattedTelegramOptions {
  symbol?: string
  explainer?: string
  link?: string
}

export interface RetryOptions {
  /** Total attempts (PRD FR-D2: retry 3x). */
  retries?: number
  backoffMs?: number
  sleep?: (ms: number) => Promise<void>
}

export interface DeliveryResult {
  status: 'ok' | 'fail'
  attempts: number
  error?: string
}

function shortAddress(address: string): string {
  if (address.length <= 10)
    return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

const EMOJI: Record<string, string> = {
  buy: '🟢',
  sell: '🔴',
  lp_add: '💧',
  lp_remove: '🚨',
  claim_fees: '💸',
  transfer: '↔️',
  burn: '🔥',
  mint_created: '🆕',
}

/**
 * Formats a Telegram alert (FR-D2). Boost-branded templates land in M4.3.
 */
export function formatTelegramMessage(event: TxEvent, options: FormattedTelegramOptions = {}): string {
  const symbol = options.symbol ?? event.mint.slice(0, 6)
  const emoji = EMOJI[event.type] ?? '⚪'
  const lines = [
    `${emoji} ${event.type.toUpperCase()} ${event.sol_amount.toFixed(4)} SOL · ${symbol}`,
    `wallet ${shortAddress(event.wallet)} · ${event.dex}`,
  ]

  if (options.explainer)
    lines.push(options.explainer)
  if (options.link)
    lines.push(options.link)

  return lines.join('\n')
}

/**
 * HMAC-SHA256 signature for webhook-out deliveries (PRD NFR: webhook-out only for paid, HMAC).
 */
export function signWebhookPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * Sends with exponential backoff. After the configured attempts the delivery is marked failed;
 * the caller records it in delivery_log and can show the "degraded" banner (AC-D2.2).
 */
export async function deliverWithRetry(
  adapter: DeliveryAdapter,
  payload: DeliveryPayload,
  logger: Logger,
  options: RetryOptions = {},
): Promise<DeliveryResult> {
  const attemptsAllowed = options.retries ?? 3
  const backoffMs = options.backoffMs ?? 250
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)))

  let lastError = ''

  for (let attempt = 1; attempt <= attemptsAllowed; attempt++) {
    try {
      await adapter.send(payload)
      return { status: 'ok', attempts: attempt }
    }
    catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      logger.warn({ attempt, error: lastError }, 'delivery.retry')

      if (attempt < attemptsAllowed) {
        await sleep(backoffMs * 2 ** (attempt - 1))
      }
    }
  }

  logger.error({ attempts: attemptsAllowed, error: lastError }, 'delivery.fail')
  return { status: 'fail', attempts: attemptsAllowed, error: lastError }
}
