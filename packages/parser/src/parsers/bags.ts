import type { HeliusInstruction, HeliusTransaction, LegacyTransaction } from '../types'
import bs58 from 'bs58'
import { BaseParser } from './base'

export class BagsParser extends BaseParser {
  private static readonly BAGS_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN'

  private static readonly HEX_DISCRIMINATORS = {
    CREATE_POOL: '8c55d7b06636684f',
  }

  canParse(transaction: HeliusTransaction): boolean {
    const allInstructions = this.getAllInstructions(transaction)
    return allInstructions.some(ix => ix.programId === BagsParser.BAGS_PROGRAM) || false
  }

  parse(transaction: HeliusTransaction, tokenMint: string): LegacyTransaction | null {
    const { feePayer } = transaction
    const allInstructions = this.getAllInstructions(transaction)

    const bagsInstructions = allInstructions.filter(ix => ix.programId === BagsParser.BAGS_PROGRAM)

    for (const ix of bagsInstructions) {
      if (!ix.data) continue
      try {
        const buffer = Buffer.from(bs58.decode(ix.data))
        const discriminator = buffer.slice(0, 8).toString('hex')
        if (discriminator === BagsParser.HEX_DISCRIMINATORS.CREATE_POOL) {
          return this.parseCreatePool(transaction, tokenMint, feePayer)
        }
      } catch {
        // ignore decode errors
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

  private parseCreatePool(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string,
  ): LegacyTransaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers } = heliusTx

    let creator = feePayer
    const solCost = 0

    if (nativeTransfers) {
      const fundingTransfer = nativeTransfers.find(t => t.toUserAccount === feePayer)
      if (fundingTransfer) {
        creator = fundingTransfer.fromUserAccount
      }
    }

    let tokenAmount = 0
    if (tokenTransfers) {
      const mintTransfer = tokenTransfers.find(
        t => t.mint === tokenMint && (!t.fromUserAccount || t.fromUserAccount === ''),
      )
      if (mintTransfer) {
        tokenAmount = mintTransfer.tokenAmount
      }
    }

    return {
      id: signature,
      signature,
      type: 'CREATE_POOL',
      wallet: creator,
      tokenAmount,
      solAmount: solCost,
      timestamp: Date.now(),
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'BAGS',
    }
  }
}
