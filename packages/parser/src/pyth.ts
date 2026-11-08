/**
 * Pyth Hermes price adapter (PRD §2.4 / AC-A1.2).
 * SOL price is never hardcoded; it is pulled from Pyth and cached for 2 seconds.
 */

export const PYTH_SOL_USD_FEED_ID
  = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'

export const PYTH_CACHE_TTL_MS = 2_000

export const DEFAULT_PYTH_HERMES_URL = 'https://hermes.pyth.network'

export interface PythAdapterOptions {
  /** Inject a fetch implementation (tests / non-global environments). */
  fetchImpl?: typeof fetch
  /** Inject a clock (ms since epoch). */
  now?: () => number
  /** Override the Hermes base URL. */
  hermesUrl?: string
}

interface PriceCacheEntry {
  price: number
  at: number
}

const cache = new Map<string, PriceCacheEntry>()

interface HermesParsedPrice {
  price: string
  conf: string
  expo: number
  publish_time: number
}

interface HermesResponse {
  parsed?: Array<{ price: HermesParsedPrice }>
}

/**
 * Returns the SOL/USD price from Pyth Hermes, cached for 2 seconds.
 */
export async function getSolUsdPrice(options: PythAdapterOptions = {}): Promise<number> {
  const now = options.now ?? Date.now
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const hermesUrl = options.hermesUrl ?? DEFAULT_PYTH_HERMES_URL

  const cached = cache.get(PYTH_SOL_USD_FEED_ID)
  if (cached && now() - cached.at < PYTH_CACHE_TTL_MS) {
    return cached.price
  }

  const url = `${hermesUrl}/v2/updates/price/latest?ids[]=${PYTH_SOL_USD_FEED_ID}&parsed=true`
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Pyth Hermes request failed: ${response.status}`)
  }

  const body = (await response.json()) as HermesResponse
  const parsed = body.parsed?.[0]?.price
  if (!parsed) {
    throw new Error('Pyth Hermes response did not include a SOL/USD price')
  }

  const price = Number(parsed.price) * 10 ** parsed.expo
  cache.set(PYTH_SOL_USD_FEED_ID, { price, at: now() })
  return price
}

/**
 * Converts a SOL amount to USD at the supplied SOL/USD price.
 */
export function solToUsd(solAmount: number, solUsdPrice: number): number {
  return solAmount * solUsdPrice
}

/**
 * Converts a USD amount to SOL at the supplied SOL/USD price.
 */
export function usdToSol(usdAmount: number, solUsdPrice: number): number {
  if (solUsdPrice <= 0) {
    throw new Error('SOL/USD price must be greater than zero')
  }
  return usdAmount / solUsdPrice
}

/**
 * Clears the in-memory cache (used by tests).
 */
export function resetPythCache(): void {
  cache.clear()
}
