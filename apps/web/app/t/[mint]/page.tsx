import type { Metadata } from 'next'
import type { PricePoint, TokenSnapshot } from '@tmr/analytics'
import Link from 'next/link'
import { aggregateTokenEvents } from '@tmr/analytics'
import { DEMO_MINTS, loadDemoEventsForMint } from '@/lib/demo-data'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { mint: string }
}

const PULSE_COLOR: Record<string, string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-red-400',
}

const PULSE_LABEL: Record<string, string> = {
  green: 'Dev Pulse · healthy',
  yellow: 'Dev Pulse · watch',
  red: 'Dev Pulse · dev sold',
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function formatSol(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} SOL`
}

function formatToken(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatPrice(value: number): string {
  return value < 0.001 ? value.toExponential(3) : value.toFixed(6)
}

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `${shortAddress(params.mint)} · Token Monitor`,
    description: `Live Solana analytics for ${params.mint} — volume, buys/sells, net flow, LP status and Dev Pulse.`,
  }
}

function StatCard({ label, value, hint }: { label: string, value: string, hint?: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-600">{hint}</div>}
    </div>
  )
}

function Sparkline({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return <div className="h-28 flex items-center justify-center text-zinc-600 text-sm">Not enough price data</div>
  }

  const width = 640
  const height = 112
  const prices = points.map(point => point.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1

  const coordinates = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width
    const y = height - ((point.price - min) / span) * (height - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none">
      <polyline points={coordinates} fill="none" stroke="#34d399" strokeWidth="2" />
    </svg>
  )
}

function snapshotForMint(mint: string): TokenSnapshot {
  return aggregateTokenEvents(mint, loadDemoEventsForMint(mint), { now: Date.now() })
}

export default function TokenPage({ params }: PageProps) {
  const snapshot = snapshotForMint(params.mint)
  const hasData = snapshot.recent.length > 0

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-200 p-6 md:p-10 font-mono">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-emerald-400">
                {shortAddress(params.mint)}
              </h1>
              <span className="px-2 py-0.5 rounded border border-amber-700/60 bg-amber-950/40 text-amber-300 text-xs">
                DEMO DATA
              </span>
            </div>
            <p className="text-zinc-500 text-xs mt-1 break-all">{params.mint}</p>
          </div>
          <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <span className={`h-2.5 w-2.5 rounded-full ${PULSE_COLOR[snapshot.devPulse]}`} />
            <span className="text-xs text-zinc-300">{PULSE_LABEL[snapshot.devPulse]}</span>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-600">
          SSR token page (FR-B3). Data source: golden fixtures through Parser v2; DB/Helius wiring is next.
        </div>

        {!hasData
          ? (
              <div className="mt-10 rounded border border-zinc-800 bg-zinc-900/40 p-8 text-center">
                <div className="text-zinc-300">No indexed events for this mint yet.</div>
                <div className="text-zinc-600 text-sm mt-2">
                  Try a demo mint:
                  {' '}
                  {DEMO_MINTS.map((entry, index) => (
                    <span key={entry.mint}>
                      {index > 0 && ' · '}
                      <Link href={`/t/${entry.mint}`} className="text-emerald-400 hover:underline">
                        {entry.label}
                      </Link>
                    </span>
                  ))}
                </div>
              </div>
            )
          : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  <StatCard label="24h volume" value={formatSol(snapshot.volume24hSol)} />
                  <StatCard label="7d volume" value={formatSol(snapshot.volume7dSol)} />
                  <StatCard label="Buys / Sells 24h" value={`${snapshot.buys24h} / ${snapshot.sells24h}`} />
                  <StatCard label="Unique wallets 24h" value={snapshot.uniqueWallets24h.toString()} />
                  <StatCard
                    label="Net flow 24h"
                    value={formatSol(snapshot.netFlow24hSol)}
                    hint={snapshot.netFlow24hSol >= 0 ? 'inflow' : 'outflow'}
                  />
                  <StatCard
                    label="LP status"
                    value={snapshot.lpStatus.toUpperCase()}
                    hint={`last liquidity event`}
                  />
                  <StatCard
                    label="VWAP 5m"
                    value={snapshot.vwap5mSol === null ? '—' : formatPrice(snapshot.vwap5mSol)}
                    hint="SOL per token"
                  />
                  <StatCard label="Events" value={snapshot.recent.length.toString()} />
                </div>

                <div className="mt-6 rounded border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Price series (last events)</div>
                  <Sparkline points={snapshot.priceSeries} />
                </div>

                <div className="mt-6 rounded border border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                    Live feed (demo)
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/60 text-zinc-500">
                      <tr>
                        <th className="text-left px-4 py-2">time</th>
                        <th className="text-left px-4 py-2">type</th>
                        <th className="text-left px-4 py-2">dex</th>
                        <th className="text-right px-4 py-2">SOL</th>
                        <th className="text-right px-4 py-2">tokens</th>
                        <th className="text-left px-4 py-2">wallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.recent.map((event, index) => (
                        <tr key={`${event.wallet}-${event.block_time}-${index}`} className="border-t border-zinc-900">
                          <td className="px-4 py-2 text-zinc-500">
                            {new Date(event.block_time * 1000).toISOString().slice(11, 19)}
                          </td>
                          <td className={`px-4 py-2 font-bold ${
                            event.type === 'buy'
                              ? 'text-emerald-400'
                              : event.type === 'sell'
                                ? 'text-red-400'
                                : 'text-zinc-400'
                          }`}
                          >
                            {event.type}
                          </td>
                          <td className="px-4 py-2 text-zinc-400">{event.dex}</td>
                          <td className="px-4 py-2 text-right text-emerald-300">{event.sol_amount.toFixed(6)}</td>
                          <td className="px-4 py-2 text-right text-zinc-400">{formatToken(event.token_amount)}</td>
                          <td className="px-4 py-2 text-zinc-500">{shortAddress(event.wallet)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

        <div className="mt-6 text-xs text-zinc-600">
          Top holders, holder PnL and real-time SSE are scheduled for M1.5 / M2.
          {' '}
          <Link href="/" className="text-emerald-400 hover:underline">← back</Link>
        </div>
      </div>
    </main>
  )
}
