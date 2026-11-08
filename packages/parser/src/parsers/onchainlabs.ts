import type { HeliusTransaction, LegacyTransaction } from '../types'
import { BaseParser } from './base'

const WSOL_MINT = 'So11111111111111111111111111111111111111112'

export class OnchainLabsParser extends BaseParser {
  private static readonly PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ'
  private static readonly ROUTER_V1 = '6m2CDdhRgxpH4WjvdzxAYBGxwdGUz5MziiL5jek2kBma'

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction
    return (
      instructions?.some(
        ix =>
          ix.programId === OnchainLabsParser.PROGRAM_ID
          || ix.programId === OnchainLabsParser.ROUTER_V1
          || ix.innerInstructions?.some(
            inner =>
              inner.programId === OnchainLabsParser.PROGRAM_ID
              || inner.programId === OnchainLabsParser.ROUTER_V1,
          ),
      ) || false
    )
  }

  parse(transaction: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    const { tokenTransfers, nativeTransfers, feePayer } = transaction

    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint)
    if (!tokenTransfer)
      return null

    let wallet = feePayer || ''
    let type: 'BUY' | 'SELL' = 'BUY'

    if (tokenTransfer.fromUserAccount === feePayer) {
      type = 'SELL'
      wallet = feePayer
    }
    else if (tokenTransfer.toUserAccount === feePayer) {
      type = 'BUY'
      wallet = feePayer
    }
    else {
      if (
        tokenTransfer.fromUserAccount
        && tokenTransfer.fromUserAccount !== OnchainLabsParser.PROGRAM_ID
        && tokenTransfer.fromUserAccount !== OnchainLabsParser.ROUTER_V1
      ) {
        wallet = tokenTransfer.fromUserAccount
        type = 'SELL'
      }
      else if (
        tokenTransfer.toUserAccount
        && tokenTransfer.toUserAccount !== OnchainLabsParser.PROGRAM_ID
        && tokenTransfer.toUserAccount !== OnchainLabsParser.ROUTER_V1
      ) {
        wallet = tokenTransfer.toUserAccount
        type = 'BUY'
      }
    }

    let solAmount = 0

    const nativeAmounts = new Set(nativeTransfers?.map(t => t.amount) || [])

    if (tokenTransfers) {
      for (const transfer of tokenTransfers) {
        if (transfer.mint === WSOL_MINT) {
          let amount = transfer.tokenAmount
          if (Number.isInteger(amount) && nativeAmounts.has(amount)) {
            amount = amount / 1e9
          }
          else if (amount > 1_000_000_000) {
            amount = amount / 1e9
          }

          if (type === 'BUY' && transfer.fromUserAccount === wallet) {
            solAmount += amount
          }
          else if (type === 'SELL' && transfer.toUserAccount === wallet) {
            solAmount += amount
          }
        }
      }

      if (solAmount === 0) {
        for (const transfer of tokenTransfers) {
          if (transfer.mint === WSOL_MINT) {
            let amount = transfer.tokenAmount
            if (Number.isInteger(amount) && nativeAmounts.has(amount)) {
              amount = amount / 1e9
            }
            else if (amount > 1_000_000_000) {
              amount = amount / 1e9
            }
            if (amount > solAmount) {
              solAmount = amount
            }
          }
        }
      }
    }

    if (solAmount === 0 && nativeTransfers) {
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
      if (type === 'BUY') {
        solAmount = sent / 1e9
      }
      else {
        solAmount = received / 1e9
      }
      if (solAmount === 0) {
        solAmount = Math.max(sent, received) / 1e9
      }
    }

    return this.createTransaction(
      transaction,
      type,
      wallet,
      tokenTransfer.tokenAmount,
      tokenMint,
      'Onchain Labs',
      solAmount,
    )
  }
}
