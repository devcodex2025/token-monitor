import type { HeliusTransaction, TxEvent } from '@tmr/parser'

export interface Logger {
  info: (fields: Record<string, unknown>, message?: string) => void
  warn: (fields: Record<string, unknown>, message?: string) => void
  error: (fields: Record<string, unknown>, message?: string) => void
}

export interface EventRepository {
  /**
   * Persists an event idempotently by transaction signature.
   * Returns inserted=false when the signature already exists.
   */
  insertEvent: (input: { event: TxEvent, raw: HeliusTransaction }) => Promise<{ inserted: boolean, id?: number }>
}

export interface EventStream {
  publish: (event: TxEvent) => Promise<void>
}
