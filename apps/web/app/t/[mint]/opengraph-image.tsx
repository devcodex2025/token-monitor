import { ImageResponse } from 'next/og'
import { aggregateTokenEvents } from '@tmr/analytics'
import { loadDemoEventsForMint } from '@/lib/demo-data'

export const alt = 'Token Monitor — Solana token analytics'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-dynamic'

interface ImageProps {
  params: { mint: string }
}

const PULSE: Record<string, string> = {
  green: '#34d399',
  yellow: '#fbbf24',
  red: '#f87171',
}

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

/**
 * Standard OG card (PRD FR-B4 / AC-B3.2). Branded variant for Boost lands in M4.2.
 */
export default function OpengraphImage({ params }: ImageProps) {
  const snapshot = aggregateTokenEvents(params.mint, loadDemoEventsForMint(params.mint), { now: Date.now() })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0a0a',
          color: '#e4e4e7',
          padding: '64px',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 20, height: 20, borderRadius: 9999, background: PULSE[snapshot.devPulse] }} />
            <div style={{ fontSize: 28, color: '#34d399' }}>Token Monitor</div>
          </div>
          <div style={{ fontSize: 20, color: '#71717a' }}>tmr.watch</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 64, color: '#fafafa' }}>{short(params.mint)}</div>
          <div style={{ fontSize: 22, color: '#71717a' }}>{params.mint}</div>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 24, border: '1px solid #27272a', borderRadius: 12 }}>
            <div style={{ fontSize: 18, color: '#71717a' }}>24h volume</div>
            <div style={{ fontSize: 34, color: '#fafafa' }}>{snapshot.volume24hSol.toFixed(4)} SOL</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 24, border: '1px solid #27272a', borderRadius: 12 }}>
            <div style={{ fontSize: 18, color: '#71717a' }}>Buys / Sells</div>
            <div style={{ fontSize: 34, color: '#fafafa' }}>
              {snapshot.buys24h}
              {' / '}
              {snapshot.sells24h}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 24, border: '1px solid #27272a', borderRadius: 12 }}>
            <div style={{ fontSize: 18, color: '#71717a' }}>LP status</div>
            <div style={{ fontSize: 34, color: '#fafafa' }}>{snapshot.lpStatus.toUpperCase()}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
