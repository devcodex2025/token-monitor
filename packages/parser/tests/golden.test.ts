import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toTxEvent } from '../src/events'
import { TransactionParser } from '../src/transactionParser'
import type { HeliusTransaction, LegacyTransaction, TxEventType } from '../src/types'

const FIXTURES_DIR = fileURLToPath(new URL('../__fixtures__', import.meta.url))

interface GoldenEntry {
  fixture: string
  arrayIndex: number
  mint: string
  type: LegacyTransaction['type']
  dex: string
  wallet: string
  solAmount: number
  tokenAmount: number
}

const EVENT_TYPE: Record<LegacyTransaction['type'], TxEventType> = {
  BUY: 'buy',
  SELL: 'sell',
  ADD_LIQUIDITY: 'lp_add',
  REMOVE_LIQUIDITY: 'lp_remove',
  CLAIM_FEES: 'claim_fees',
  TRANSFER: 'transfer',
  CREATE_POOL: 'mint_created',
}

const golden = JSON.parse(
  fs.readFileSync(`${FIXTURES_DIR}/golden.json`, 'utf8'),
) as GoldenEntry[]

function loadTransaction(entry: GoldenEntry): HeliusTransaction {
  const raw = JSON.parse(fs.readFileSync(`${FIXTURES_DIR}/${entry.fixture}`, 'utf8'))
  return Array.isArray(raw) ? raw[entry.arrayIndex >= 0 ? entry.arrayIndex : 0] : raw
}

describe('golden parser fixtures (AC-A1.1)', () => {
  it('covers all fixture files that are Enhanced transactions', () => {
    expect(golden.length).toBeGreaterThanOrEqual(27)
  })

  for (const entry of golden) {
    it(`${entry.fixture} matches legacy golden output`, () => {
      const parsed = TransactionParser.parse(loadTransaction(entry), entry.mint)

      expect(parsed).not.toBeNull()
      expect(parsed!.type).toBe(entry.type)
      expect(parsed!.dex).toBe(entry.dex)
      expect(parsed!.wallet).toBe(entry.wallet)
      expect(Math.abs(parsed!.solAmount - entry.solAmount)).toBeLessThanOrEqual(1e-9)
      expect(Math.abs(parsed!.tokenAmount - entry.tokenAmount)).toBeLessThanOrEqual(1e-9)

      const event = toTxEvent(parsed!, { mint: entry.mint })
      expect(event.type).toBe(EVENT_TYPE[entry.type])
      expect(event.mint).toBe(entry.mint)
      expect(event.wallet).toBe(entry.wallet)
      expect(Math.abs(event.sol_amount - entry.solAmount)).toBeLessThanOrEqual(1e-9)
    })
  }
})
