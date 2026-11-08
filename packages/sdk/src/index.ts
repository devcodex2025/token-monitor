/**
 * Public SDK (PRD FR-G3). Implementation lands in M5.3; scaffolded in M0.1.
 */
export const SDK_VERSION = '0.1.0'

export interface TokenSummary {
  mint: string
  symbol?: string
  priceUsd?: number
  volume24hSol?: number
}
