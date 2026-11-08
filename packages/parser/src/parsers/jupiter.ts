import type { HeliusTransaction, LegacyTransaction } from '../types'
import bs58 from 'bs58'
import { BaseParser } from './base'

const WSOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

export class JupiterParser extends BaseParser {
  private static readonly JUPITER_V6_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
  private static readonly JUPITER_LIMIT_ORDER_PROGRAM_ID = 'j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X'

  private decodeLimitOrderData(data: string): { makingAmount: bigint, takingAmount: bigint } | null {
    try {
      const buffer = Buffer.from(bs58.decode(data))
      if (buffer.length < 32) return null
      const makingAmount = buffer.readBigUInt64LE(16)
      const takingAmount = buffer.readBigUInt64LE(24)
      return { makingAmount, takingAmount }
    } catch {
      return null
    }
  }

  private calculateSwapValue(
    transaction: HeliusTransaction,
    wallet: string,
    type: 'BUY' | 'SELL',
    tokenMint: string,
  ): { solAmount: number, displayToken: string, score: number } {
    const { tokenTransfers, nativeTransfers, instructions } = transaction
    let solAmount = 0
    let displayToken = 'SOL'
    let score = 0

    if (tokenTransfers) {
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
    if (solAmount > 0) score = 3

    if (nativeTransfers) {
      let nativeAmount = 0
      for (const transfer of nativeTransfers) {
        if (type === 'SELL' && transfer.toUserAccount === wallet) {
          nativeAmount += transfer.amount
        } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
          nativeAmount += transfer.amount
        }
      }
      if (nativeAmount > 0 && score < 3) {
        solAmount += nativeAmount / 1e9
        score = 3
      }
    }

    if (score < 3 && instructions) {
      const jupiterInstruction = instructions.find(
        ix =>
          ix.programId === JupiterParser.JUPITER_V6_PROGRAM_ID
          || ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID,
      )

      if (jupiterInstruction?.innerInstructions) {
        for (const inner of jupiterInstruction.innerInstructions) {
          if (inner.programId === '11111111111111111111111111111111') {
            try {
              const data = Buffer.from(bs58.decode(inner.data ?? ''))
              if (data.length >= 12) {
                const instructionIndex = data.readUInt32LE(0)
                if (instructionIndex === 2) {
                  const amount = Number(data.readBigUInt64LE(4))
                  const source = inner.accounts?.[0]
                  const dest = inner.accounts?.[1]

                  if (type === 'BUY') {
                    if (source === wallet) {
                      solAmount += amount / 1e9
                      score = 3
                    }
                  } else {
                    if (dest === wallet) {
                      solAmount += amount / 1e9
                      score = 3
                    }
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }
    }

    if (score === 0 && tokenTransfers) {
      for (const transfer of tokenTransfers) {
        if (transfer.mint === tokenMint) continue
        if (transfer.mint === WSOL_MINT) continue

        let amount = 0
        if (type === 'SELL' && transfer.toUserAccount === wallet) {
          amount = transfer.tokenAmount
        } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
          amount = transfer.tokenAmount
        }

        if (amount > 0) {
          solAmount = amount
          if (transfer.mint === USDC_MINT) {
            displayToken = 'USDC'
            score = 2
          } else if (transfer.mint === USDT_MINT) {
            displayToken = 'USDT'
            score = 2
          } else {
            displayToken = 'UNKNOWN'
            score = 1
          }
          break
        }
      }
    }

    return { solAmount, displayToken, score }
  }

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction
    return (
      instructions?.some(
        ix =>
          ix.programId === JupiterParser.JUPITER_V6_PROGRAM_ID
          || ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID,
      ) || false
    )
  }

  parse(transaction: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    const { signature, timestamp, tokenTransfers, feePayer, instructions, accountData } = transaction

    let relevantTransfers = tokenTransfers?.filter(t => t.mint === tokenMint) || []

    if (relevantTransfers.length === 0 && accountData) {
      const accountChanges = accountData.filter(ad =>
        ad.tokenBalanceChanges?.some(tbc => tbc.mint === tokenMint),
      )

      if (accountChanges.length > 0) {
        relevantTransfers = accountChanges.flatMap((ad) => {
          const change = ad.tokenBalanceChanges!.find(tbc => tbc.mint === tokenMint)!
          if (!change.rawTokenAmount) return []

          const rawAmount = change.rawTokenAmount
          const amount = Number.parseFloat(rawAmount.tokenAmount) / 10 ** rawAmount.decimals

          if (amount === 0) return []

          if (amount < 0) {
            return [{
              fromUserAccount: change.userAccount || ad.account,
              toUserAccount: '',
              tokenAmount: Math.abs(amount),
              mint: tokenMint,
              tokenStandard: 'Fungible',
            }]
          } else {
            return [{
              fromUserAccount: '',
              toUserAccount: change.userAccount || ad.account,
              tokenAmount: amount,
              mint: tokenMint,
              tokenStandard: 'Fungible',
            }]
          }
        })
      }
    }

    if (relevantTransfers.length === 0) return null

    let wallet = feePayer || ''
    let type: 'BUY' | 'SELL' | 'TRANSFER' = 'BUY'
    let tokenAmount = 0
    let solAmount = 0
    let displayToken = 'SOL'
    let dex = 'Jupiter'

    const isLimitOrder = instructions?.some(ix => ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID)

    if (isLimitOrder) {
      const incoming = relevantTransfers.filter(t => t.toUserAccount === feePayer)
      if (incoming.length > 0) {
        type = 'TRANSFER'
        wallet = feePayer
        tokenAmount = incoming.reduce((sum, t) => sum + t.tokenAmount, 0)
        displayToken = 'Cancel Order'
        dex = 'Jupiter Limit Order'

        return {
          id: signature,
          signature,
          type,
          wallet,
          tokenAmount,
          solAmount: 0,
          timestamp: Date.now(),
          blockTime: timestamp,
          displayToken,
          dex,
        }
      }

      const outgoing = relevantTransfers.filter(t => t.fromUserAccount === feePayer)
      if (outgoing.length > 0) {
        const limitOrderIx = instructions?.find(ix => ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID)
        let orderSolAmount = 0

        if (limitOrderIx) {
          const decoded = this.decodeLimitOrderData(limitOrderIx.data ?? '')
          if (decoded) {
            const accounts = limitOrderIx.accounts
            if (accounts && accounts.length > 8) {
              const takingMint = accounts[8]
              if (takingMint === WSOL_MINT) {
                orderSolAmount = Number(decoded.takingAmount) / 1e9
              }
            }
          }
        }

        type = 'SELL'
        wallet = feePayer
        tokenAmount = outgoing.reduce((sum, t) => sum + t.tokenAmount, 0)
        dex = 'Jupiter Limit Order'

        return {
          id: signature,
          signature,
          type,
          wallet,
          tokenAmount,
          solAmount: orderSolAmount,
          timestamp: Date.now(),
          blockTime: timestamp,
          displayToken,
          dex,
        }
      }
    }

    const candidates: {
      wallet: string
      type: 'BUY' | 'SELL'
      tokenAmount: number
      solAmount: number
      displayToken: string
      score: number
    }[] = []
    const wallets = new Set<string>()
    relevantTransfers.forEach((t) => {
      if (t.toUserAccount) wallets.add(t.toUserAccount)
      if (t.fromUserAccount) wallets.add(t.fromUserAccount)
    })

    for (const candidateWallet of wallets) {
      const incoming = relevantTransfers.filter(t => t.toUserAccount === candidateWallet)
      if (incoming.length > 0) {
        const amount = incoming.reduce((sum, t) => sum + t.tokenAmount, 0)
        const { solAmount: s, displayToken: d, score } = this.calculateSwapValue(transaction, candidateWallet, 'BUY', tokenMint)
        candidates.push({ wallet: candidateWallet, type: 'BUY', tokenAmount: amount, solAmount: s, displayToken: d, score })
      }

      const outgoing = relevantTransfers.filter(t => t.fromUserAccount === candidateWallet)
      if (outgoing.length > 0) {
        const amount = outgoing.reduce((sum, t) => sum + t.tokenAmount, 0)
        const { solAmount: s, displayToken: d, score } = this.calculateSwapValue(transaction, candidateWallet, 'SELL', tokenMint)
        candidates.push({ wallet: candidateWallet, type: 'SELL', tokenAmount: amount, solAmount: s, displayToken: d, score })
      }
    }

    candidates.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (Math.abs(a.solAmount - b.solAmount) > 1e-9) return b.solAmount - a.solAmount
      if (a.type === 'BUY' && b.type === 'SELL') return -1
      if (a.type === 'SELL' && b.type === 'BUY') return 1
      if (a.wallet === feePayer) return -1
      if (b.wallet === feePayer) return 1
      return 0
    })

    const best = candidates[0]
    if (best) {
      wallet = best.wallet
      type = best.type
      tokenAmount = best.tokenAmount
      solAmount = best.solAmount
      displayToken = best.displayToken
    } else {
      wallet = feePayer
    }

    return {
      id: signature,
      signature,
      type,
      wallet,
      tokenAmount,
      solAmount,
      timestamp: Date.now(),
      blockTime: timestamp,
      displayToken,
      dex,
    }
  }
}
