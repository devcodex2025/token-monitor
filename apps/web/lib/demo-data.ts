import type { TxEvent } from '@tmr/parser'
import fs from 'node:fs'
import path from 'node:path'
import { TransactionParser, toTxEvent } from '@tmr/parser'

interface GoldenEntry {
  fixture: string
  arrayIndex: number
  mint: string
}

export const DEMO_MINTS: Array<{ mint: string, label: string }> = [
  { mint: '67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev', label: 'Pump.fun / OKX fixtures' },
  { mint: 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump', label: 'Meteora fixtures' },
]

function fixturesDir(): string {
  return path.resolve(process.cwd(), '..', '..', 'packages', 'parser', '__fixtures__')
}

/**
 * Demo-only data source for M1.3: replays the golden fixtures through Parser v2 and
 * shifts timestamps so 24h/7d windows are meaningful. DB-backed loading lands with the
 * repository/page wiring in the next M1 task.
 */
export function loadDemoEvents(): TxEvent[] {
  const dir = fixturesDir()
  const golden = JSON.parse(
    fs.readFileSync(path.join(dir, 'golden.json'), 'utf8'),
  ) as GoldenEntry[]

  const events: TxEvent[] = []

  for (const entry of golden) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, entry.fixture), 'utf8'))
    const tx = Array.isArray(raw) ? raw[entry.arrayIndex >= 0 ? entry.arrayIndex : 0] : raw
    const parsed = TransactionParser.parse(tx, entry.mint)
    if (!parsed) continue

    events.push(toTxEvent(parsed, {
      mint: entry.mint,
      slot: tx.slot,
      feeSol: typeof tx.fee === 'number' ? tx.fee / 1e9 : undefined,
    }))
  }

  if (events.length === 0) return events

  const newest = Math.max(...events.map(event => event.block_time))
  const nowSec = Math.floor(Date.now() / 1000)
  const shift = nowSec - 30 - newest

  return events.map(event => ({ ...event, block_time: event.block_time + shift }))
}

export function loadDemoEventsForMint(mint: string): TxEvent[] {
  return loadDemoEvents().filter(event => event.mint === mint)
}
