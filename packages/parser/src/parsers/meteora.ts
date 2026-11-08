import type { HeliusInstruction, HeliusTransaction, LegacyTransaction } from '../types'
import bs58 from 'bs58'
import { BaseParser } from './base'

const WSOL_MINT = 'So11111111111111111111111111111111111111112'

export class MeteoraParser extends BaseParser {
  private static readonly METEORA_DLMM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

  private static readonly DISCRIMINATORS = {
    ADD_LIQUIDITY: '4Co7us6MBHJN',
    ADD_LIQUIDITY_STRATEGY: '2GpD59YMjQrR',
    REMOVE_LIQUIDITY: '7FKxUv3oxZY',
    REMOVE_LIQUIDITY_BY_RANGE: 'BH9xzWhK5ook',
    CLAIM_FEE: 'fx9RHbGFfZ9',
  }

  private static readonly HEX_DISCRIMINATORS = {
    ADD_LIQUIDITY_ONE_SIDE: '235613b94ed44bd3',
    ADD_LIQUIDITY_STRATEGY_V2: '5c04b0c177b95309',
  }

  canParse(transaction: HeliusTransaction): boolean {
    const allInstructions = this.getAllInstructions(transaction)
    return allInstructions.some(ix => ix.programId === MeteoraParser.METEORA_DLMM) || false
  }

  parse(transaction: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    const { feePayer } = transaction
    const allInstructions = this.getAllInstructions(transaction)

    const meteoraInstructions = allInstructions.filter(ix => ix.programId === MeteoraParser.METEORA_DLMM)

    for (const ix of meteoraInstructions) {
      if (!ix.data) continue

      if (
        ix.data.startsWith(MeteoraParser.DISCRIMINATORS.ADD_LIQUIDITY)
        || ix.data.startsWith(MeteoraParser.DISCRIMINATORS.ADD_LIQUIDITY_STRATEGY)
      ) {
        return this.parseAddLiquidity(transaction, tokenMint, feePayer)
      }

      try {
        const buffer = Buffer.from(bs58.decode(ix.data))
        const discriminator = buffer.slice(0, 8).toString('hex')

        if (
          discriminator === MeteoraParser.HEX_DISCRIMINATORS.ADD_LIQUIDITY_ONE_SIDE
          || discriminator === MeteoraParser.HEX_DISCRIMINATORS.ADD_LIQUIDITY_STRATEGY_V2
        ) {
          return this.parseAddLiquidity(transaction, tokenMint, feePayer)
        }
      } catch {
        // ignore decode errors
      }

      if (
        ix.data.startsWith(MeteoraParser.DISCRIMINATORS.REMOVE_LIQUIDITY)
        || ix.data.startsWith(MeteoraParser.DISCRIMINATORS.REMOVE_LIQUIDITY_BY_RANGE)
      ) {
        return this.parseRemoveLiquidity(transaction, tokenMint, feePayer)
      }
      if (ix.data.startsWith(MeteoraParser.DISCRIMINATORS.CLAIM_FEE)) {
        return this.parseClaimFees(transaction, tokenMint, feePayer)
      }
    }

    return null
  }

  private getAllInstructions(transaction: HeliusTransaction): HeliusInstruction[] {
    const allInstructions: HeliusInstruction[] = []
    if (transaction.instructions) {
      for (const ix of transaction.instructions) {
        allInstructions.push(ix)
        if (ix.innerInstructions) {
          allInstructions.push(...ix.innerInstructions)
        }
      }
    }
    return allInstructions
  }

  private parseClaimFees(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string,
  ): LegacyTransaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers } = heliusTx

    const calculateAmounts = (targetWallet: string) => {
      let sol = 0
      let token = 0

      if (nativeTransfers) {
        for (const transfer of nativeTransfers) {
          if (transfer.toUserAccount === targetWallet) {
            sol += transfer.amount / 1e9
          }
        }
      }

      if (tokenTransfers) {
        for (const transfer of tokenTransfers) {
          if (transfer.toUserAccount === targetWallet) {
            if (transfer.mint === WSOL_MINT) {
              sol += transfer.tokenAmount
            } else if (transfer.mint === tokenMint) {
              token += transfer.tokenAmount
            }
          }
        }
      }
      return { sol, token }
    }

    let wallet = feePayer
    let { sol: solAmount, token: tokenAmount } = calculateAmounts(wallet)

    if (solAmount === 0 && tokenAmount === 0 && tokenTransfers) {
      const candidateTransfer = tokenTransfers.find(
        t => t.mint === tokenMint && t.toUserAccount && t.toUserAccount !== feePayer,
      )

      if (candidateTransfer) {
        wallet = candidateTransfer.toUserAccount
        const result = calculateAmounts(wallet)
        solAmount = result.sol
        tokenAmount = result.token
      }
    }

    return {
      id: signature,
      signature,
      type: 'CLAIM_FEES',
      wallet: wallet || '',
      tokenAmount,
      solAmount,
      timestamp: Date.now(),
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'Meteora',
    }
  }

  private parseAddLiquidity(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string,
  ): LegacyTransaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers } = heliusTx

    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint && t.fromUserAccount === feePayer)
    const wsolTransfer = tokenTransfers?.find(t => t.mint === WSOL_MINT && t.fromUserAccount === feePayer)

    const tokenAmount = tokenTransfer?.tokenAmount || 0
    let solAmount = wsolTransfer?.tokenAmount || 0

    if (nativeTransfers) {
      for (const transfer of nativeTransfers) {
        if (transfer.fromUserAccount === feePayer) {
          solAmount += transfer.amount / 1e9
        }
      }
    }

    return {
      id: signature,
      signature,
      type: 'ADD_LIQUIDITY',
      wallet: feePayer || '',
      tokenAmount,
      solAmount,
      timestamp: Date.now(),
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'Meteora',
    }
  }

  private parseRemoveLiquidity(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string,
  ): LegacyTransaction | null {
    const { signature, timestamp, accountData, tokenTransfers: allTokenTransfers, nativeTransfers } = heliusTx

    let solAmount = 0
    let tokenAmount = 0
    let claimFeesAmount = 0
    const tokenTransfers = allTokenTransfers || []
    const wsolTransfersToUser: number[] = []

    if (nativeTransfers) {
      for (const transfer of nativeTransfers) {
        if (transfer.toUserAccount === feePayer) {
          wsolTransfersToUser.push(transfer.amount / 1e9)
        }
      }
    }

    for (const transfer of tokenTransfers) {
      const isUserReceiving = transfer.toUserAccount === feePayer
      if (isUserReceiving) {
        if (transfer.mint === WSOL_MINT) {
          wsolTransfersToUser.push(transfer.tokenAmount)
        } else if (transfer.mint === tokenMint) {
          tokenAmount += transfer.tokenAmount
        }
      }
    }

    wsolTransfersToUser.sort((a, b) => a - b)

    const uniqueAmounts: number[] = []
    const usedIndices = new Set<number>()

    for (let i = 0; i < wsolTransfersToUser.length; i++) {
      if (usedIndices.has(i)) continue

      const current = wsolTransfersToUser[i]!
      let isDuplicate = false

      for (let j = i + 1; j < wsolTransfersToUser.length; j++) {
        if (usedIndices.has(j)) continue
        const next = wsolTransfersToUser[j]!
        if (Math.abs(next - current) < 0.003) {
          uniqueAmounts.push(next)
          usedIndices.add(j)
          isDuplicate = true
          break
        }
      }

      if (!isDuplicate) {
        uniqueAmounts.push(current)
      }
    }

    if (uniqueAmounts.length > 1) {
      uniqueAmounts.sort((a, b) => a - b)
      claimFeesAmount = uniqueAmounts[0]!
      solAmount = uniqueAmounts.slice(1).reduce((sum, amt) => sum + amt, 0)
    } else {
      solAmount = uniqueAmounts[0] || 0
    }

    if (solAmount === 0 && accountData) {
      for (const accountChange of accountData) {
        if (accountChange.account === feePayer && accountChange.nativeBalanceChange) {
          const balanceChange = accountChange.nativeBalanceChange
          if (balanceChange > 0) {
            solAmount = balanceChange / 1e9
          }
        }

        if (accountChange.tokenBalanceChanges) {
          for (const balanceChange of accountChange.tokenBalanceChanges) {
            if (balanceChange.mint === tokenMint && balanceChange.rawTokenAmount) {
              const rawAmount = Number.parseFloat(balanceChange.rawTokenAmount.tokenAmount)
              if (rawAmount > 0) {
                const decimals = balanceChange.rawTokenAmount.decimals || 6
                tokenAmount += rawAmount / 10 ** decimals
              }
            } else if (balanceChange.mint === WSOL_MINT && balanceChange.rawTokenAmount && solAmount === 0) {
              const rawAmount = Number.parseFloat(balanceChange.rawTokenAmount.tokenAmount)
              if (rawAmount > 0) {
                const decimals = balanceChange.rawTokenAmount.decimals || 9
                solAmount += rawAmount / 10 ** decimals
              }
            }
          }
        }
      }
    }

    return {
      id: signature,
      signature,
      type: 'REMOVE_LIQUIDITY',
      wallet: feePayer || '',
      tokenAmount,
      solAmount,
      timestamp: Date.now(),
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'Meteora',
      claimFeesAmount: claimFeesAmount > 0 ? claimFeesAmount : undefined,
    }
  }
}
