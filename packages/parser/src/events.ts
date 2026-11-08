import type { LegacyTransaction, TxEvent, TxEventType } from './types'

/**
 * Maps the internal legacy transaction taxonomy to the PRD §2.5 TxEvent taxonomy.
 */
const LEGACY_TO_EVENT_TYPE: Record<LegacyTransaction['type'], TxEventType> = {
  BUY: 'buy',
  SELL: 'sell',
  ADD_LIQUIDITY: 'lp_add',
  REMOVE_LIQUIDITY: 'lp_remove',
  CLAIM_FEES: 'claim_fees',
  TRANSFER: 'transfer',
  CREATE_POOL: 'mint_created',
}

export interface TxEventContext {
  mint: string
  signature?: string
  slot?: number
  feeSol?: number
}

/**
 * Converts a parsed legacy transaction into the canonical TxEvent.
 * price_at_tx is expressed in SOL per token (sol_amount / token_amount).
 */
export function toTxEvent(tx: LegacyTransaction, ctx: TxEventContext): TxEvent {
  const event: TxEvent = {
    mint: ctx.mint,
    type: LEGACY_TO_EVENT_TYPE[tx.type],
    dex: tx.dex ?? 'Unknown',
    signature: ctx.signature,
    slot: ctx.slot,
    block_time: tx.blockTime,
    wallet: tx.wallet,
    sol_amount: tx.solAmount,
    token_amount: tx.tokenAmount,
    fee_sol: ctx.feeSol,
  }

  if (tx.tokenAmount > 0 && tx.solAmount > 0) {
    event.price_at_tx = tx.solAmount / tx.tokenAmount
  }

  return event
}
