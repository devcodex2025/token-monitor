export interface NonceRecord {
  nonce: string
  address: string
  domain: string
  issuedAt: number
  expiresAt: number
}

export interface NonceStore {
  issue: (record: NonceRecord) => Promise<void> | void
  consume: (nonce: string) => Promise<NonceRecord | null> | NonceRecord | null
}

export interface Session {
  token: string
  wallet: string
  createdAt: number
  expiresAt: number
}

export interface SessionStore {
  create: (wallet: string) => Promise<Session> | Session
  get: (token: string) => Promise<Session | null> | Session | null
  revoke: (token: string) => Promise<void> | void
}

export type SiwsFailureReason
  = | 'nonce_not_found'
    | 'nonce_expired'
    | 'address_mismatch'
    | 'invalid_signature'
    | 'malformed_input'

export type SiwsVerification
  = | { ok: true, wallet: string }
    | { ok: false, reason: SiwsFailureReason }
