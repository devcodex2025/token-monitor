import type { HeliusTransaction, LegacyTransaction } from '../types'
import { BaseParser } from './base'

const WSOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

export class DFlowParser extends BaseParser {
  private static readonly DFLOW_PROGRAM_ID = 'DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH'

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction
    return instructions?.some(ix => ix.programId === DFlowParser.DFLOW_PROGRAM_ID) || false
  }

  parse(transaction: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    const { tokenTransfers, nativeTransfers, feePayer } = transaction

    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint)
    if (!tokenTransfer) return null

    let wallet = feePayer || ''
    let type: 'BUY' | 'SELL' = 'BUY'

    if (tokenTransfer.fromUserAccount === feePayer) {
      type = 'SELL'
      wallet = feePayer
    } else if (tokenTransfer.toUserAccount === feePayer) {
      type = 'BUY'
      wallet = feePayer
    }

    let solAmount = 0

    if (nativeTransfers) {
      let sent = 0
      let received = 0
      for (const transfer of nativeTransfers) {
        if (transfer.fromUserAccount === wallet) {
          sent += transfer.amount
        }
        if (transfer.toUserAccount === wallet) {
          received += transfer.amount
        }
      }
      solAmount = Math.max(sent, received) / 1e9
    }

    let wsolAmount = 0

    if (tokenTransfers) {
      for (const transfer of tokenTransfers) {
        if (transfer.mint === WSOL_MINT) {
          if (type === 'SELL' && transfer.toUserAccount === wallet) {
            wsolAmount += transfer.tokenAmount
          } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
            wsolAmount += transfer.tokenAmount
          }
        }
      }
    }

    if (wsolAmount > 0) {
      solAmount = wsolAmount
    } else if (solAmount === 0 && tokenTransfers) {
      for (const transfer of tokenTransfers) {
        if (transfer.mint === WSOL_MINT) {
          if (type === 'SELL' && transfer.toUserAccount === wallet) {
            solAmount += transfer.tokenAmount
          } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
            solAmount += transfer.tokenAmount
          }
        }
      }
    }

    let displayToken = 'SOL'

    if (solAmount < 0.01 && tokenTransfers) {
      let totalUsdc = 0
      let totalUsdt = 0

      for (const transfer of tokenTransfers) {
        if (transfer.mint === USDC_MINT) {
          if (type === 'SELL' && transfer.toUserAccount === wallet) {
            totalUsdc += transfer.tokenAmount
          } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
            totalUsdc += transfer.tokenAmount
          }
        } else if (transfer.mint === USDT_MINT) {
          if (type === 'SELL' && transfer.toUserAccount === wallet) {
            totalUsdt += transfer.tokenAmount
          } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
            totalUsdt += transfer.tokenAmount
          }
        }
      }

      if (totalUsdc > 0) {
        solAmount = totalUsdc
        displayToken = 'USDC'
      } else if (totalUsdt > 0) {
        solAmount = totalUsdt
        displayToken = 'USDT'
      }
    }

    return this.createTransaction(
      transaction,
      type,
      wallet,
      tokenTransfer.tokenAmount,
      tokenMint,
      'DFlow',
      solAmount,
      displayToken,
    )
  }
}
