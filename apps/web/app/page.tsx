import type { Metadata } from 'next'
import Link from 'next/link'
import TokenSearch from '@/components/TokenSearch'
import { DEMO_MINTS } from '@/lib/demo-mints'

export const metadata: Metadata = {
  title: 'Token Monitor — Solana analytics',
  description: 'Free analytics for every Solana token. Turbo speed, AI insights and Owner Boost for teams.',
}

const FEATURES = [
  {
    name: 'Free',
    price: '$0',
    tagline: 'Analytics for any token',
    points: ['24h / 7d volume', 'Buys & sells', 'Unique wallets', 'Net flow', 'LP status', 'Dev Pulse'],
    accent: 'border-zinc-700',
  },
  {
    name: 'Turbo',
    price: '$29/mo',
    tagline: 'Speed + pro metrics',
    points: ['Helius fast path', '10 watchlist tokens', 'Holder PnL', 'Liquidity depth', 'CSV / JSON export', 'Rules + alerts'],
    accent: 'border-emerald-600/60',
  },
  {
    name: 'AI Insights',
    price: '$19/mo',
    tagline: 'Explain the data',
    points: ['Token Brief', 'Alert explainer', 'AI monitor builder', 'Q&A in Telegram', 'Daily digest'],
    accent: 'border-sky-600/50',
  },
  {
    name: 'Owner Boost',
    price: '$99/mo',
    tagline: 'For token teams',
    points: ['Verified token page', 'Custom branding + OG', 'Branded TG bot', 'Embed widget', 'Boost analytics'],
    accent: 'border-amber-600/50',
  },
]

const LIVE = [
  {
    title: 'Token page',
    href: `/t/${DEMO_MINTS[0]!.mint}`,
    description: 'SSR analytics page with volume, buys/sells, net flow, LP status and Dev Pulse.',
    badge: 'M1 preview',
  },
  {
    title: 'Parser v2 demo',
    href: '/dev/parser',
    description: '27 legacy golden fixtures parsed into the canonical TxEvent taxonomy.',
    badge: 'M0.2',
  },
  {
    title: 'Legacy monitor',
    href: '/legacy',
    description: 'The old single-token live monitor, kept available during the migration.',
    badge: 'legacy',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-200 font-mono">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-md bg-emerald-500/15 border border-emerald-500/40 grid place-items-center text-emerald-400 font-bold">
              T
            </span>
            <div>
              <div className="text-lg font-bold text-zinc-100">TokenMonitor</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">$TMR · Solana</div>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <a href="#pricing" className="hover:text-emerald-400">Pricing</a>
            <a href="#live" className="hover:text-emerald-400">Live</a>
            <Link href="/legacy" className="hover:text-emerald-400">Old monitor</Link>
            <a
              href="https://github.com/devcodex2025/token-monitor"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400"
            >
              GitHub
            </a>
          </nav>
        </header>

        <section className="mt-20 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            M1 preview · live on Solana
          </div>
          <h1 className="mt-5 text-4xl md:text-6xl font-bold leading-tight text-zinc-50">
            Transparency & analytics
            <span className="block text-emerald-400">for every Solana token.</span>
          </h1>
          <p className="mt-5 text-zinc-400 text-base md:text-lg max-w-2xl">
            Free token analytics for everyone. Turbo for speed and pro metrics, AI Insights to explain
            the data, and Owner Boost for token teams. Crypto-only billing on Solana.
          </p>
          <div className="mt-8">
            <TokenSearch />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>Try a demo:</span>
            {DEMO_MINTS.map(entry => (
              <Link
                key={entry.mint}
                href={`/t/${entry.mint}`}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-300 hover:border-emerald-600 hover:text-emerald-300"
              >
                {entry.label}
              </Link>
            ))}
          </div>
        </section>

        <section id="pricing" className="mt-20">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">Plans</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {FEATURES.map(feature => (
              <div key={feature.name} className={`rounded-xl border ${feature.accent} bg-zinc-900/50 p-5`}>
                <div className="flex items-baseline justify-between">
                  <div className="text-zinc-100 font-semibold">{feature.name}</div>
                  <div className="text-emerald-400 text-sm">{feature.price}</div>
                </div>
                <div className="text-xs text-zinc-500 mt-1">{feature.tagline}</div>
                <ul className="mt-4 space-y-1.5 text-sm text-zinc-400">
                  {feature.points.map(point => (
                    <li key={point} className="flex gap-2">
                      <span className="text-emerald-500">›</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Bundle Turbo + AI = $39/mo. 12-month prepay −20%. Hold ≥1M $TMR for a discount.
          </p>
        </section>

        <section id="live" className="mt-20">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">What is live now</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {LIVE.map(item => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-emerald-700/70 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="text-zinc-100 font-semibold">{item.title}</div>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 border border-emerald-700/50 rounded px-1.5 py-0.5">
                    {item.badge}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-500">{item.description}</p>
                <div className="mt-3 text-sm text-emerald-400">Open →</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">Roadmap</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-emerald-400">Done</div>
              <ul className="mt-1 space-y-1 text-zinc-400">
                <li>M0 foundation (parser, DB, SIWS, env)</li>
                <li>M1.1–M1.6 data + free analytics</li>
                <li>M2 billing / rules / delivery core</li>
              </ul>
            </div>
            <div>
              <div className="text-amber-400">Next</div>
              <ul className="mt-1 space-y-1 text-zinc-400">
                <li>DB-backed token page + backfill</li>
                <li>Dashboard + Phantom login</li>
                <li>Turbo page + export routes</li>
              </ul>
            </div>
            <div>
              <div className="text-zinc-500">Later</div>
              <ul className="mt-1 space-y-1 text-zinc-500">
                <li>AI features live (M3)</li>
                <li>Owner Boost + embed (M4)</li>
                <li>Public API + MCP (M5)</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-zinc-900 pt-6 pb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-zinc-600">
          <div>© 2026 Token Monitor · $TMR</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/legacy" className="hover:text-emerald-400">Old monitor</Link>
            <Link href="/dev/parser" className="hover:text-emerald-400">Parser demo</Link>
            <a href="https://github.com/devcodex2025/token-monitor" target="_blank" rel="noreferrer" className="hover:text-emerald-400">
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </main>
  )
}
