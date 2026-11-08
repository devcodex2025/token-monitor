import type { Session, SessionStore } from './types'
import { randomBytes } from 'node:crypto'

export interface SessionStoreOptions {
  ttlMs?: number
  now?: () => number
}

/**
 * In-memory opaque session store. Production wiring uses a signed cookie / Redis.
 */
export function createInMemorySessionStore(options: SessionStoreOptions = {}): SessionStore {
  const now = options.now ?? Date.now
  const ttlMs = options.ttlMs ?? 7 * 24 * 60 * 60 * 1000
  const sessions = new Map<string, Session>()

  return {
    create(wallet) {
      const token = randomBytes(32).toString('base64url')
      const session: Session = {
        token,
        wallet,
        createdAt: now(),
        expiresAt: now() + ttlMs,
      }
      sessions.set(token, session)
      return session
    },
    get(token) {
      const session = sessions.get(token)
      if (!session)
        return null
      if (now() >= session.expiresAt) {
        sessions.delete(token)
        return null
      }
      return session
    },
    revoke(token) {
      sessions.delete(token)
    },
  }
}
