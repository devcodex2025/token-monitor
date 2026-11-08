import type { TxEventContext } from './events'
import type { HeliusTransaction, TxEvent } from './types'
import { toTxEvent } from './events'
import { TransactionParser } from './transactionParser'

export * from './events'
export * from './infer'
export { BagsParser } from './parsers/bags'
export { DFlowParser } from './parsers/dflow'
export { TransactionParser }
export { JupiterParser } from './parsers/jupiter'
export { MeteoraParser } from './parsers/meteora'
export { OKXParser } from './parsers/okx'
export { OnchainLabsParser } from './parsers/onchainlabs'
export { PumpFunParser } from './parsers/pumpfun'
export * from './pyth'
export * from './types'

/**
 * Parses a raw Helius transaction into the canonical TxEvent.
 */
export function parseTxEvent(
  heliusTx: HeliusTransaction,
  mint: string,
  context: Omit<TxEventContext, 'mint'> = {},
): TxEvent | null {
  const parsed = TransactionParser.parse(heliusTx, mint)
  if (!parsed)
    return null
  return toTxEvent(parsed, { mint, ...context })
}
