import type { HeliusTransaction, LegacyTransaction, LegacyTxType } from '../types'

export interface DexParser {
  canParse: (transaction: HeliusTransaction) => boolean
  parse: (transaction: HeliusTransaction, tokenMint: string) => LegacyTransaction | null
}

const WSOL_MINT = 'So11111111111111111111111111111111111111112'

export abstract class BaseParser implements DexParser {
  abstract canParse(transaction: HeliusTransaction): boolean
  abstract parse(transaction: HeliusTransaction, tokenMint: string): LegacyTransaction | null

  protected createTransaction(
    heliusTx: HeliusTransaction,
    type: LegacyTxType,
    wallet: string,
    tokenAmount: number,
    tokenMint: string,
    dex: string,
    solAmountOverride?: number,
    displayTokenOverride?: string,
  ): LegacyTransaction {
    const { signature, timestamp, nativeTransfers, tokenTransfers } = heliusTx
    let solAmount = solAmountOverride || 0
    const displayToken = displayTokenOverride || 'SOL'

    if (solAmount === 0) {
      if (nativeTransfers) {
        for (const transfer of nativeTransfers) {
          if (type === 'BUY') {
            if (transfer.fromUserAccount === wallet && transfer.toUserAccount !== wallet) {
              solAmount += transfer.amount
            }
          }
          else if (type === 'SELL') {
            if (transfer.toUserAccount === wallet && transfer.fromUserAccount !== wallet) {
              solAmount += transfer.amount
            }
          }
        }
        solAmount = solAmount / 1e9
      }

      if (solAmount === 0 && tokenTransfers) {
        for (const transfer of tokenTransfers) {
          if (transfer.mint === WSOL_MINT) {
            let isRelevant
              = (type === 'BUY' && transfer.fromUserAccount === wallet)
                || (type === 'SELL' && transfer.toUserAccount === wallet)

            if (!isRelevant && heliusTx.feePayer) {
              isRelevant
                = (type === 'BUY' && transfer.fromUserAccount === heliusTx.feePayer)
                  || (type === 'SELL' && transfer.toUserAccount === heliusTx.feePayer)
            }

            if (isRelevant) {
              solAmount += transfer.tokenAmount
            }
          }
        }

        // Global fallback: take the largest WSOL transfer.
        if (solAmount === 0) {
          let maxAmount = 0
          for (const transfer of tokenTransfers) {
            if (transfer.mint === WSOL_MINT && transfer.tokenAmount > maxAmount) {
              maxAmount = transfer.tokenAmount
            }
          }
          solAmount = maxAmount
        }
      }

      if (solAmount === 0 && heliusTx.accountData) {
        const userAccountData = heliusTx.accountData.find(a => a.account === wallet)
        if (userAccountData && userAccountData.nativeBalanceChange) {
          const change = userAccountData.nativeBalanceChange
          if (type === 'BUY' && change < 0) {
            solAmount = Math.abs(change) / 1e9
          }
          else if (type === 'SELL' && change > 0) {
            solAmount = change / 1e9
          }
        }
      }
    }

    return {
      id: signature,
      signature,
      type,
      wallet: wallet || heliusTx.feePayer || '',
      tokenAmount,
      solAmount,
      displayToken,
      timestamp: Date.now(),
      blockTime: timestamp,
      dex,
      walletBalance: heliusTx.accountBalances?.[wallet],
    }
  }

  protected isUserAccount(address: string): boolean {
    const knownPrograms = [
      '11111111111111111111111111111111',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
      '6m2CDdhRgxpH4WjvdzxAYBGxwdGUz5MziiL5jek2kBma',
      'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
    ]
    return !knownPrograms.includes(address)
  }
}
