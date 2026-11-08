/**
 * Shared types for the Token Monitor parser.
 * PRD §2.5 — TxEvent is the single output type of Parser v2.
 */

export interface HeliusTokenTransfer {
  fromUserAccount: string
  toUserAccount: string
  fromTokenAccount?: string
  toTokenAccount?: string
  tokenAmount: number
  mint: string
  tokenStandard?: string
}

export interface HeliusNativeTransfer {
  fromUserAccount: string
  toUserAccount: string
  amount: number
}

export interface HeliusTokenBalanceChange {
  userAccount?: string
  tokenAccount?: string
  mint: string
  rawTokenAmount: {
    tokenAmount: string
    decimals: number
  }
}

export interface HeliusAccountData {
  account: string
  nativeBalanceChange?: number
  tokenBalanceChanges?: HeliusTokenBalanceChange[]
}

export interface HeliusInstruction {
  programId: string
  data?: string
  accounts?: string[]
  innerInstructions?: HeliusInstruction[]
}

/** Raw Enhanced Webhook payload from Helius. */
export interface HeliusTransaction {
  signature: string
  timestamp: number
  slot?: number
  type: string
  source?: string
  feePayer: string
  fee?: number
  transactionError?: unknown
  instructions?: HeliusInstruction[]
  events?: unknown
  tokenTransfers?: HeliusTokenTransfer[]
  nativeTransfers?: HeliusNativeTransfer[]
  accountData?: HeliusAccountData[]
  accountBalances?: Record<string, number>
}

/** Internal legacy-compatible shape produced by individual DEX parsers. */
export type LegacyTxType =
  | 'BUY'
  | 'SELL'
  | 'REMOVE_LIQUIDITY'
  | 'CLAIM_FEES'
  | 'ADD_LIQUIDITY'
  | 'TRANSFER'
  | 'CREATE_POOL'

export interface LegacyTransaction {
  id: string
  signature: string
  type: LegacyTxType
  wallet: string
  tokenAmount: number
  solAmount: number
  timestamp: number
  blockTime: number
  displayToken?: string
  dex?: string
  claimFeesAmount?: number
  walletBalance?: number
}

/** PRD §2.5 taxonomy. */
export type TxEventType =
  | 'buy'
  | 'sell'
  | 'lp_add'
  | 'lp_remove'
  | 'claim_fees'
  | 'transfer'
  | 'burn'
  | 'mint_created'

export interface TxEvent {
  mint: string
  type: TxEventType
  dex: string
  signature?: string
  slot?: number
  block_time: number
  wallet: string
  sol_amount: number
  token_amount: number
  price_at_tx?: number
  fee_sol?: number
  related_wallets?: string[]
  raw?: unknown
}
