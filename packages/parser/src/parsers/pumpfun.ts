import type { HeliusTransaction, LegacyTransaction } from '../types'
import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import { BaseParser } from './base'

export class PumpFunParser extends BaseParser {
  private static readonly PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'

  canParse(transaction: HeliusTransaction): boolean {
    const { source, instructions } = transaction
    return (
      source === 'PUMP_FUN'
      || source === 'PUMP_AMM'
      || instructions?.some(ix => ix.programId === PumpFunParser.PUMP_FUN_PROGRAM_ID)
      || false
    )
  }

  parse(transaction: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    try {
      const { tokenTransfers, instructions } = transaction

      const pumpFunProgram = new PublicKey(PumpFunParser.PUMP_FUN_PROGRAM_ID)
      const [bondingCurve] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), new PublicKey(tokenMint).toBuffer()],
        pumpFunProgram,
      )
      const bondingCurveAddress = bondingCurve.toBase58()

      let curveTransfer = tokenTransfers?.find(
        t =>
          t.mint === tokenMint
          && (t.fromUserAccount === bondingCurveAddress || t.toUserAccount === bondingCurveAddress),
      )

      if (!curveTransfer && (transaction.source === 'PUMP_FUN' || transaction.source === 'PUMP_AMM')) {
        curveTransfer = tokenTransfers?.find(t => t.mint === tokenMint)
      }

      if (!curveTransfer) {
        return null
      }

      let type: 'BUY' | 'SELL'
      let wallet: string

      const isFromCurve = curveTransfer.fromUserAccount === bondingCurveAddress
      const isToCurve = curveTransfer.toUserAccount === bondingCurveAddress

      if (isFromCurve) {
        type = 'BUY'
        wallet = curveTransfer.toUserAccount
      } else if (isToCurve) {
        type = 'SELL'
        wallet = curveTransfer.fromUserAccount
      } else {
        if (curveTransfer.toUserAccount === transaction.feePayer) {
          type = 'BUY'
          wallet = curveTransfer.toUserAccount
        } else {
          type = 'SELL'
          wallet = curveTransfer.fromUserAccount
        }
      }

      let solAmount = 0

      const pumpInstruction = instructions?.find(ix => ix.programId === PumpFunParser.PUMP_FUN_PROGRAM_ID)

      if (pumpInstruction?.innerInstructions) {
        for (const inner of pumpInstruction.innerInstructions) {
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
                      solAmount += amount
                    }
                  } else {
                    if (dest === wallet) {
                      solAmount += amount
                    }
                  }
                }
              }
            } catch {
              // ignore malformed inner instruction
            }
          }
        }
      }

      if (solAmount > 0) {
        solAmount = solAmount / 1e9
      } else if (transaction.nativeTransfers) {
        for (const transfer of transaction.nativeTransfers) {
          if (type === 'BUY') {
            if (transfer.fromUserAccount === wallet && transfer.toUserAccount !== wallet) {
              solAmount += transfer.amount
            }
          } else if (type === 'SELL') {
            if (transfer.toUserAccount === wallet && transfer.fromUserAccount !== wallet) {
              solAmount += transfer.amount
            }
          }
        }
        if (solAmount > 0) {
          solAmount = solAmount / 1e9
        }
      }

      return this.createTransaction(
        transaction,
        type,
        wallet,
        curveTransfer.tokenAmount,
        tokenMint,
        'Pump.fun',
        solAmount,
      )
    } catch {
      return null
    }
  }
}
