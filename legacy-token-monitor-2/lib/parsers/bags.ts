import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';
import bs58 from 'bs58';

export class BagsParser extends BaseParser {
  private static BAGS_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';
  private static HEX_DISCRIMINATORS = {
    CREATE_POOL: '8c55d7b06636684f', // Init/Create instruction
  };

  canParse(transaction: HeliusTransaction): boolean {
    const allInstructions = this.getAllInstructions(transaction);
    return (
      allInstructions.some((ix: any) => ix.programId === BagsParser.BAGS_PROGRAM) ||
      false
    );
  }

  parse(transaction: HeliusTransaction, tokenMint: string): Transaction | null {
    const { feePayer, signature, timestamp, tokenTransfers, nativeTransfers } = transaction;
    const allInstructions = this.getAllInstructions(transaction);
    
    // Check for specific instruction discriminators
    const bagsInstructions = allInstructions.filter((ix: any) => 
      ix.programId === BagsParser.BAGS_PROGRAM
    );

    if (bagsInstructions) {
      for (const ix of bagsInstructions) {
        if (ix.data) {
          try {
            const buffer = bs58.decode(ix.data);
            const discriminator = buffer.slice(0, 8).toString('hex');
            
            if (discriminator === BagsParser.HEX_DISCRIMINATORS.CREATE_POOL) {
               return this.parseCreatePool(transaction, tokenMint, feePayer);
            }
          } catch (e) {
            // ignore decode errors
          }
        }
      }
    }

    return null; 
  }

  private getAllInstructions(transaction: HeliusTransaction): any[] {
    const allInstructions: any[] = [];
    if (transaction.instructions) {
      for (const ix of transaction.instructions) {
        allInstructions.push(ix);
        if (ix.innerInstructions) {
          allInstructions.push(...ix.innerInstructions);
        }
      }
    }
    return allInstructions;
  }

  private parseCreatePool(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string
  ): Transaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers } = heliusTx;
    
    // Try to find the real user (often funds the fee payer or is the authority)
    // In the provided example, 2oZzc... funds the BAGS... fee payer
    let creator = feePayer;
    let solCost = 0;

    if (nativeTransfers) {
        // Look for incoming transfer to feePayer
        const fundingTransfer = nativeTransfers.find(t => t.toUserAccount === feePayer);
        if (fundingTransfer) {
            creator = fundingTransfer.fromUserAccount;
        }

        // Calculate SOL cost (transfers from creator or fee payer to others)
        // Usually cost includes creation fees.
    }

    // Token Amount: Usually the initial supply minting
    let tokenAmount = 0;
    if (tokenTransfers) {
        const mintTransfer = tokenTransfers.find(t => t.mint === tokenMint && (!t.fromUserAccount || t.fromUserAccount === ''));
        if (mintTransfer) {
            tokenAmount = mintTransfer.tokenAmount;
        }
    }

    return {
      id: signature,
      signature,
      type: 'CREATE_POOL',
      wallet: creator,
      tokenAmount,
      solAmount: solCost, // Can refer to creation cost if relevant, otherwise 0
      timestamp: Date.now(),
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'BAGS',
    };
  }
}
