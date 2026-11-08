import fs from 'node:fs'
import path from 'node:path'
import type { TxEvent } from '@tmr/parser'
import { TransactionParser, toTxEvent } from '@tmr/parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface GoldenEntry {
  fixture: string
  arrayIndex: number
  mint: string
  type: string
  dex: string
  wallet: string
  solAmount: number
  tokenAmount: number
}

interface Row extends GoldenEntry {
  event: TxEvent | null
}

function loadRows(): Row[] {
  const dir = path.resolve(process.cwd(), '..', '..', 'packages', 'parser', '__fixtures__')
  const golden = JSON.parse(
    fs.readFileSync(path.join(dir, 'golden.json'), 'utf8'),
  ) as GoldenEntry[]

  return golden.map((entry) => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, entry.fixture), 'utf8'))
    const tx = Array.isArray(raw) ? raw[entry.arrayIndex >= 0 ? entry.arrayIndex : 0] : raw
    const parsed = TransactionParser.parse(tx, entry.mint)
    const event = parsed ? toTxEvent(parsed, { mint: entry.mint }) : null
    return { ...entry, event }
  })
}

const TYPE_COLOR: Record<string, string> = {
  buy: 'text-emerald-400',
  sell: 'text-red-400',
  lp_add: 'text-sky-400',
  lp_remove: 'text-orange-400',
  claim_fees: 'text-violet-400',
  transfer: 'text-zinc-400',
  mint_created: 'text-yellow-300',
  burn: 'text-pink-400',
}

export default function DevParserPage(): JSX.Element {
  const rows = loadRows()
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const type = row.event?.type ?? 'null'
    acc[type] = (acc[type] ?? 0) + 1
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-200 p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-emerald-400">Parser v2 — M0.2</h1>
        <p className="text-zinc-500 mt-2">
          {rows.length} golden fixtures parsed by <code>@tmr/parser</code> → canonical{' '}
          <code>TxEvent</code> (PRD §2.5).
        </p>

        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(counts).sort().map(([type, count]) => (
            <span key={type} className="px-3 py-1 rounded border border-zinc-800 bg-zinc-900 text-sm">
              <span className={TYPE_COLOR[type] ?? 'text-zinc-300'}>{type}</span>
              <span className="text-zinc-500"> × {count}</span>
            </span>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto rounded border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="text-left px-3 py-2">fixture</th>
                <th className="text-left px-3 py-2">type</th>
                <th className="text-left px-3 py-2">dex</th>
                <th className="text-right px-3 py-2">sol_amount</th>
                <th className="text-right px-3 py-2">token_amount</th>
                <th className="text-left px-3 py-2">wallet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.fixture} className="border-t border-zinc-900 hover:bg-zinc-900/40">
                  <td className="px-3 py-2 text-zinc-400">{row.fixture}</td>
                  <td className={`px-3 py-2 font-bold ${TYPE_COLOR[row.event?.type ?? ''] ?? 'text-zinc-500'}`}>
                    {row.event?.type ?? 'null'}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{row.event?.dex ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-emerald-300">
                    {row.event ? row.event.sol_amount.toFixed(6) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {row.event ? row.event.token_amount.toLocaleString('en-US') : '—'}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {row.event ? `${row.event.wallet.slice(0, 6)}…${row.event.wallet.slice(-4)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-zinc-600 text-xs mt-4">
          Dev-only page for M0.2 verification. The product token page (/t/[mint]) lands in M1.3.
        </p>
      </div>
    </main>
  )
}
