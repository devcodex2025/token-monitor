import type { TxEvent } from '@tmr/parser'
import { describe, expect, it } from 'vitest'
import { eventsToCsv, eventsToJson } from '../src/export'

function event(partial: Partial<TxEvent> = {}): TxEvent {
  return {
    mint: 'MINT',
    type: 'buy',
    dex: 'Pump.fun',
    signature: 'sig-1',
    slot: 10,
    block_time: 1_760_000_100,
    wallet: 'wallet-1',
    sol_amount: 1.5,
    token_amount: 1000,
    price_at_tx: 0.0015,
    fee_sol: 0.000005,
    ...partial,
  }
}

describe('CSV/JSON export (FR-D3)', () => {
  it('writes a header and one row per event, oldest first', () => {
    const csv = eventsToCsv([
      event({ signature: 'newer', block_time: 200 }),
      event({ signature: 'older', block_time: 100 }),
    ])
    const lines = csv.split('\n')

    expect(lines[0]).toBe('signature,mint,type,dex,slot,block_time,wallet,sol_amount,token_amount,price_at_tx,fee_sol')
    expect(lines[1]!.startsWith('older,')).toBe(true)
    expect(lines[2]!.startsWith('newer,')).toBe(true)
  })

  it('escapes commas, quotes and newlines', () => {
    const csv = eventsToCsv([
      event({ wallet: 'a,b' }),
      event({ wallet: 'quote"inside' }),
      event({ wallet: 'line\nbreak' }),
    ])

    expect(csv).toContain('"a,b"')
    expect(csv).toContain('"quote""inside"')
    expect(csv).toContain('"line\nbreak"')
  })

  it('renders missing optional values as empty cells', () => {
    const csv = eventsToCsv([event({ signature: undefined, slot: undefined, price_at_tx: undefined, fee_sol: undefined })])
    const cells = csv.split('\n')[1]!.split(',')

    expect(cells[0]).toBe('')
    expect(cells[4]).toBe('')
  })

  it('exports valid JSON', () => {
    const json = eventsToJson([event({ signature: 'b', block_time: 2 }), event({ signature: 'a', block_time: 1 })])
    const parsed = JSON.parse(json) as TxEvent[]

    expect(parsed.map(item => item.signature)).toEqual(['a', 'b'])
  })
})
