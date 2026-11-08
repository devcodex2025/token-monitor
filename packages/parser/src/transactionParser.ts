import type { DexParser } from './parsers/base'
import type { HeliusTransaction, LegacyTransaction } from './types'
import { BagsParser } from './parsers/bags'
import { DFlowParser } from './parsers/dflow'
import { JupiterParser } from './parsers/jupiter'
import { MeteoraParser } from './parsers/meteora'
import { OKXParser } from './parsers/okx'
import { OnchainLabsParser } from './parsers/onchainlabs'
import { PumpFunParser } from './parsers/pumpfun'

const WSOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

export class TransactionParser {
  private static parsers: DexParser[] = [
    new PumpFunParser(),
    new JupiterParser(),
    new MeteoraParser(),
    new DFlowParser(),
    new OKXParser(),
    new OnchainLabsParser(),
    new BagsParser(),
  ]

  static parse(heliusTx: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    for (const parser of this.parsers) {
      if (parser.canParse(heliusTx)) {
        const result = parser.parse(heliusTx, tokenMint)
        if (result) return result
      }
    }

    return this.parseGeneric(heliusTx, tokenMint)
  }

  static parseMultiple(
    heliusTxs: HeliusTransaction[],
    tokenMint: string,
  ): { parsedTxs: LegacyTransaction[], skipReasons: Record<string, number> } {
    let skippedCount = 0
    const skipReasons: Record<string, number> = {}

    const parsedTxs = heliusTxs
      .map((tx) => {
        const parsed = this.parse(tx, tokenMint)
        if (!parsed) {
          skippedCount++
          const reasonKey = `[Type: ${tx.type}, Source: ${tx.source}]`
          skipReasons[reasonKey] = (skipReasons[reasonKey] || 0) + 1
        }
        return parsed
      })
      .filter((tx): tx is LegacyTransaction => tx !== null)

    if (skippedCount > 0) {
      console.log(`[Parser] Skipped ${skippedCount}/${heliusTxs.length} transactions in this batch.`)
    }

    return { parsedTxs, skipReasons }
  }

  private static parseGeneric(heliusTx: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    try {
      const { signature, timestamp, tokenTransfers, nativeTransfers, accountData, type, feePayer, source } = heliusTx

      const isSimpleTransfer
        = type === 'TRANSFER' || type === 'transfer' || source === 'SYSTEM_PROGRAM' || source === 'SOLANA_PROGRAM_LIBRARY'

      const hasTokenTransfer = tokenTransfers?.some(t => t.mint === tokenMint)
      if (!hasTokenTransfer) return null

      const isLikelyTransfer = isSimpleTransfer || (type === 'UNKNOWN' && source === 'UNKNOWN')
      if (!tokenTransfers || tokenTransfers.length === 0) return null

      const tokenTransfer = tokenTransfers.find(transfer => transfer.mint === tokenMint)
      if (!tokenTransfer) return null

      let toAccount = tokenTransfer.toUserAccount
      let fromAccount = tokenTransfer.fromUserAccount

      if (!toAccount || toAccount === '') toAccount = feePayer || ''
      if (!fromAccount || fromAccount === '') fromAccount = feePayer || ''

      let isBuy: boolean
      let actualWallet: string

      if (feePayer && feePayer === toAccount) {
        isBuy = true
        actualWallet = toAccount
      } else if (feePayer && feePayer === fromAccount) {
        isBuy = false
        actualWallet = fromAccount
      } else {
        const isToUser = this.isUserAccount(toAccount)
        const isFromUser = this.isUserAccount(fromAccount)

        if (isToUser && !isFromUser) {
          isBuy = true
          actualWallet = toAccount
        } else if (isFromUser && !isToUser) {
          isBuy = false
          actualWallet = fromAccount
        } else if (feePayer === toAccount) {
          isBuy = true
          actualWallet = feePayer
        } else if (feePayer === fromAccount) {
          isBuy = false
          actualWallet = feePayer
        } else {
          isBuy = true
          actualWallet = toAccount
        }
      }

      let solAmount = 0
      let displayToken = 'SOL'
      let usdcAmount = 0
      let usdtAmount = 0
      let wsolAmount = 0

      if (tokenTransfers && tokenTransfers.length > 0) {
        for (const transfer of tokenTransfers) {
          if (transfer.mint === tokenMint) continue

          const isRelevant
            = (isBuy && transfer.fromUserAccount === actualWallet)
              || (!isBuy && transfer.toUserAccount === actualWallet)

          if (isRelevant) {
            if (transfer.mint === USDC_MINT) usdcAmount += transfer.tokenAmount
            else if (transfer.mint === USDT_MINT) usdtAmount += transfer.tokenAmount
            else if (transfer.mint === WSOL_MINT) wsolAmount += transfer.tokenAmount
          }
        }

        if (wsolAmount === 0) {
          for (const transfer of tokenTransfers) {
            if (transfer.mint === WSOL_MINT && transfer.tokenAmount > wsolAmount) {
              wsolAmount = transfer.tokenAmount
            }
          }
        }
      }

      if (wsolAmount > 0) {
        solAmount = wsolAmount
        displayToken = 'SOL'
      } else if (usdcAmount > 0) {
        solAmount = usdcAmount
        displayToken = 'USDC'
      } else if (usdtAmount > 0) {
        solAmount = usdtAmount
        displayToken = 'USDT'
      }

      if (solAmount === 0 && nativeTransfers && nativeTransfers.length > 0) {
        let totalNative = 0
        for (const transfer of nativeTransfers) {
          if (isBuy) {
            if (transfer.fromUserAccount === actualWallet) totalNative += transfer.amount
          } else {
            if (transfer.toUserAccount === actualWallet) totalNative += transfer.amount
          }
        }
        solAmount = totalNative / 1e9
      }

      let dex = source || 'Unknown'
      if (accountData) {
        const programMap: Record<string, string> = {
          'boop8hVGQGQGqehUK2iVEMEnMrL5RbjywRzHKBmBE7ry4': 'BOOP.FUN',
          '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'PUMP.FUN',
          'MoonCVVNZFSYkqN5438hi3fulh6Nj59sbpxmaxhY9Q': 'MOONSHOT',
          'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA': 'PUMP_FUN_AMM',
          'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'METEORA DLMM',
          'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG': 'METEORA_DAMM_V2',
          'proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u': 'OKX DEX',
          'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'JUPITER',
          '6m2CDdhRgxpH4WjvdzxAYBGxwdGUz5MziiL5jek2kBma': 'ONCHAIN LABS',
          'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ': 'ONCHAIN LABS',
          'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN': 'BAGS',
        }

        for (const acc of accountData) {
          if (programMap[acc.account]) {
            dex = programMap[acc.account]!
            break
          }
        }
      }

      let finalType: 'BUY' | 'SELL' | 'TRANSFER' = isBuy ? 'BUY' : 'SELL'

      if (isLikelyTransfer && solAmount === 0) {
        finalType = 'TRANSFER'
        displayToken = 'Transfer'
      }

      return {
        id: signature,
        signature,
        type: finalType,
        wallet: actualWallet,
        tokenAmount: tokenTransfer.tokenAmount,
        solAmount,
        displayToken,
        timestamp: Date.now(),
        blockTime: timestamp,
        dex,
        walletBalance: heliusTx.accountBalances?.[actualWallet],
      }
    } catch (error) {
      console.error('Error parsing generic transaction:', error)
      return null
    }
  }

  private static isUserAccount(address: string): boolean {
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
