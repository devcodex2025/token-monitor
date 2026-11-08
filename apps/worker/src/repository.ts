import type { Database } from '@tmr/db'
import type { HeliusTransaction, TxEvent } from '@tmr/parser'
import type { EventRepository } from './types'
import { schema } from '@tmr/db'

/**
 * Drizzle-backed event repository. Idempotency is enforced by the UNIQUE signature column:
 * a replayed webhook inserts zero rows (AC-B1.1).
 */
export function createDrizzleEventRepository(db: Database['db']): EventRepository {
  return {
    async insertEvent({ event, raw }: { event: TxEvent, raw: HeliusTransaction }) {
      const rows = await db
        .insert(schema.txEvents)
        .values({
          mint: event.mint,
          eventType: event.type,
          dex: event.dex,
          slot: event.slot,
          blockTime: new Date(event.block_time * 1000),
          wallet: event.wallet,
          solAmount: event.sol_amount.toString(),
          tokenAmount: Math.round(event.token_amount).toString(),
          price: event.price_at_tx?.toString(),
          feeSol: event.fee_sol?.toString(),
          signature: raw.signature,
          relatedWallets: event.related_wallets ?? null,
          raw,
        })
        .onConflictDoNothing({ target: schema.txEvents.signature })
        .returning({ id: schema.txEvents.id })

      return { inserted: rows.length > 0, id: rows[0]?.id }
    },
  }
}
