import type { TxEvent } from '@tmr/parser'

export interface TokenSummary {
  mint: string
  symbol?: string
  priceUsd?: number
  volume24hSol?: number
  buys24h?: number
  sells24h?: number
  devPulse?: 'green' | 'yellow' | 'red'
  lpStatus?: 'active' | 'removed' | 'unknown'
}

export interface FeedParams {
  minSol?: number
  since?: number
  types?: string[]
  limit?: number
}

export interface TokenMonitorClientOptions {
  baseUrl: string
  apiKey: string
  fetchImpl?: typeof fetch
  retries?: number
  backoffMs?: number
  sleep?: (ms: number) => Promise<void>
}

export class ApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`Token Monitor API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export class PaymentRequiredError extends ApiError {
  constructor(body: string) {
    super(402, body)
    this.name = 'PaymentRequiredError'
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/**
 * Typed client for the public API (FR-G3).
 * Retries 429/5xx with exponential backoff; surfaces 402 as PaymentRequiredError.
 */
export class TokenMonitorClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly retries: number
  private readonly backoffMs: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: TokenMonitorClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.retries = options.retries ?? 3
    this.backoffMs = options.backoffMs ?? 250
    this.sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)))
  }

  async getTokenSummary(mint: string): Promise<TokenSummary> {
    return this.request<TokenSummary>(`/v1/token/${encodeURIComponent(mint)}`)
  }

  async getFeed(mint: string, params: FeedParams = {}): Promise<TxEvent[]> {
    const query = new URLSearchParams()
    if (params.minSol !== undefined)
      query.set('min_sol', String(params.minSol))
    if (params.since !== undefined)
      query.set('since', String(params.since))
    if (params.types?.length)
      query.set('types', params.types.join(','))
    if (params.limit !== undefined)
      query.set('limit', String(params.limit))

    const suffix = query.toString() ? `?${query.toString()}` : ''
    return this.request<TxEvent[]>(`/v1/feed/${encodeURIComponent(mint)}${suffix}`)
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            accept: 'application/json',
            ...init.headers,
          },
        })

        if (response.status === 402) {
          throw new PaymentRequiredError(await response.text())
        }

        if (RETRYABLE_STATUS.has(response.status) && attempt < this.retries) {
          await this.sleep(this.backoffMs * 2 ** (attempt - 1))
          continue
        }

        if (!response.ok) {
          throw new ApiError(response.status, await response.text())
        }

        return (await response.json()) as T
      }
      catch (error) {
        if (error instanceof PaymentRequiredError || error instanceof ApiError)
          throw error
        lastError = error
        if (attempt < this.retries) {
          await this.sleep(this.backoffMs * 2 ** (attempt - 1))
        }
      }
    }

    throw lastError instanceof Error ? lastError : new ApiError(0, 'request failed')
  }
}
