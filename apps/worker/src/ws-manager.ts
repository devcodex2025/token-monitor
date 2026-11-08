import type { Logger } from './types'

export interface WsLogEntry {
  signature: string
  err: unknown | null
  logs: string[]
}

export interface WsSubscriptionHandle {
  close: () => Promise<void> | void
}

export interface WsAdapter {
  subscribeLogs: (input: {
    mint: string
    onLogs: (entry: WsLogEntry) => void
    onError?: (error: unknown) => void
  }) => Promise<WsSubscriptionHandle>
}

interface MintSubscription {
  handle: WsSubscriptionHandle
  viewers: Set<string>
  idleTimer?: ReturnType<typeof setTimeout>
}

export interface WsManagerOptions {
  adapter: WsAdapter
  logger: Logger
  /** Maximum simultaneous log subscriptions (PRD FR-B2, default 50). */
  maxActive?: number
  /** Idle TTL before a subscription is closed (PRD FR-B2, default 10 minutes). */
  idleTtlMs?: number
  /** Fan-out hook: called for every log entry of a watched mint. */
  onLogs?: (mint: string, entry: WsLogEntry) => void
}

export class WsLimitError extends Error {
  constructor(maxActive: number) {
    super(`WS subscription limit reached (${maxActive})`)
    this.name = 'WsLimitError'
  }
}

const DEFAULT_MAX_ACTIVE = 50
const DEFAULT_IDLE_TTL_MS = 10 * 60 * 1000

/**
 * Free-path WS manager (FR-B2): one `logsSubscribe` per mint, fanned in across viewers,
 * closed after an idle TTL, and capped at maxActive subscriptions.
 */
export class FreePathWsManager {
  private readonly subscriptions = new Map<string, MintSubscription>()
  private readonly pending = new Map<string, Promise<MintSubscription>>()
  private readonly maxActive: number
  private readonly idleTtlMs: number

  constructor(private readonly options: WsManagerOptions) {
    this.maxActive = options.maxActive ?? DEFAULT_MAX_ACTIVE
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS
  }

  get activeSubscriptions(): number {
    return this.subscriptions.size
  }

  viewerCount(mint: string): number {
    return this.subscriptions.get(mint)?.viewers.size ?? 0
  }

  /**
   * Registers a viewer for a mint. Returns an idempotent unsubscribe function.
   * Three viewers of the same mint share exactly one WS subscription (AC-B2.1).
   */
  async addViewer(mint: string, viewerId: string): Promise<() => Promise<void>> {
    let entry = this.subscriptions.get(mint)

    if (!entry) {
      let pending = this.pending.get(mint)
      if (!pending) {
        pending = this.createSubscription(mint)
        this.pending.set(mint, pending)
        void pending.then(
          () => this.pending.delete(mint),
          () => this.pending.delete(mint),
        )
      }
      entry = await pending
    }

    entry.viewers.add(viewerId)
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer)
      entry.idleTimer = undefined
    }

    return async () => this.removeViewer(mint, viewerId)
  }

  private async createSubscription(mint: string): Promise<MintSubscription> {
    if (this.subscriptions.size >= this.maxActive) {
      throw new WsLimitError(this.maxActive)
    }

    const handle = await this.options.adapter.subscribeLogs({
      mint,
      onLogs: entry => this.options.onLogs?.(mint, entry),
      onError: error => this.options.logger.warn({ mint, error: String(error) }, 'ws.error'),
    })

    const entry: MintSubscription = { handle, viewers: new Set() }
    this.subscriptions.set(mint, entry)
    this.options.logger.info({ mint, active: this.subscriptions.size }, 'ws.subscribed')
    return entry
  }

  private async removeViewer(mint: string, viewerId: string): Promise<void> {
    const entry = this.subscriptions.get(mint)
    if (!entry)
      return

    entry.viewers.delete(viewerId)
    if (entry.viewers.size > 0)
      return

    entry.idleTimer = setTimeout(() => {
      void this.closeIfIdle(mint)
    }, this.idleTtlMs)
  }

  private async closeIfIdle(mint: string): Promise<void> {
    const entry = this.subscriptions.get(mint)
    if (!entry || entry.viewers.size > 0)
      return

    this.subscriptions.delete(mint)
    if (entry.idleTimer)
      clearTimeout(entry.idleTimer)
    await entry.handle.close()
    this.options.logger.info({ mint, active: this.subscriptions.size }, 'ws.closed')
  }
}
