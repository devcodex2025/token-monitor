import type { HeliusTransaction, TxEvent } from '@tmr/parser'
import type { EventRepository, EventStream, Logger } from './types'
import { inferMints, toTxEvent, TransactionParser } from '@tmr/parser'

export interface IngestDependencies {
  repository: EventRepository
  stream: EventStream
  logger: Logger
  now?: () => number
  /** Optional override; defaults to the first non-stable mint in the transaction. */
  inferMint?: (tx: HeliusTransaction) => string | null
}

export interface IngestResult {
  received: number
  inserted: number
  skipped: number
  failed: number
}

/**
 * Parses Helius transactions, persists them idempotently and publishes new events
 * to the `txs:main` Redis stream (FR-B1).
 */
export async function ingestTransactions(
  transactions: HeliusTransaction[],
  deps: IngestDependencies,
): Promise<IngestResult> {
  const result: IngestResult = {
    received: transactions.length,
    inserted: 0,
    skipped: 0,
    failed: 0,
  }

  for (const tx of transactions) {
    try {
      if (!tx?.signature || tx.transactionError) {
        result.skipped++
        continue
      }

      const mint = deps.inferMint?.(tx) ?? inferMints(tx)[0]
      if (!mint) {
        result.skipped++
        deps.logger.warn({ signature: tx.signature }, 'helius.skip_no_mint')
        continue
      }

      const parsed = TransactionParser.parse(tx, mint)
      if (!parsed) {
        result.skipped++
        deps.logger.warn({ signature: tx.signature, mint }, 'helius.skip_unparsed')
        continue
      }

      const event: TxEvent = toTxEvent(parsed, {
        mint,
        signature: tx.signature,
        slot: tx.slot,
        feeSol: typeof tx.fee === 'number' ? tx.fee / 1e9 : undefined,
      })

      const { inserted } = await deps.repository.insertEvent({ event, raw: tx })
      const ingestLagMs = (deps.now?.() ?? Date.now()) - tx.timestamp * 1000

      deps.logger.info({
        signature: tx.signature,
        mint,
        event_type: event.type,
        ingest_lag_ms: ingestLagMs,
        inserted,
      }, 'helius.ingest')

      if (inserted) {
        await deps.stream.publish(event)
        result.inserted++
      }
      else {
        result.skipped++
      }
    }
    catch (error) {
      result.failed++
      deps.logger.error({
        signature: tx?.signature,
        error: error instanceof Error ? error.message : String(error),
      }, 'helius.ingest_failed')
    }
  }

  return result
}
