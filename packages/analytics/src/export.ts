import type { TxEvent } from '@tmr/parser'

const COLUMNS = [
  'signature',
  'mint',
  'type',
  'dex',
  'slot',
  'block_time',
  'wallet',
  'sol_amount',
  'token_amount',
  'price_at_tx',
  'fee_sol',
] as const

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined)
    return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

/**
 * Exports events as CSV for the Turbo/Boost export endpoint (FR-D3).
 * Rows are ordered oldest -> newest.
 */
export function eventsToCsv(events: TxEvent[]): string {
  const sorted = [...events].sort((a, b) => a.block_time - b.block_time)
  const rows = sorted.map(event =>
    COLUMNS.map(column => escapeCsv(event[column as keyof TxEvent])).join(','),
  )
  return [COLUMNS.join(','), ...rows].join('\n')
}

/**
 * Exports events as pretty JSON (FR-D3).
 */
export function eventsToJson(events: TxEvent[]): string {
  const sorted = [...events].sort((a, b) => a.block_time - b.block_time)
  return JSON.stringify(sorted, null, 2)
}
