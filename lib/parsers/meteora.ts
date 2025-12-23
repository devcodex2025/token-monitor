import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';

export class MeteoraParser extends BaseParser {
  private static METEORA_DLMM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
  private static DISCRIMINATORS = {
    ADD_LIQUIDITY: '4Co7us6MBHJN',
    REMOVE_LIQUIDITY: '7FKxUv3oxZYZ',
  };

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction;
    return (
      instructions?.some((ix: any) => ix.programId === MeteoraParser.METEORA_DLMM) ||
      false
    );
  }

  parse(transaction: HeliusTransaction, tokenMint: string): Transaction | null {
    const { instructions, feePayer } = transaction;
    
    // Check for specific instruction discriminators
    const meteoraInstructions = instructions?.filter((ix: any) => 
      ix.programId === MeteoraParser.METEORA_DLMM
    );

    if (meteoraInstructions) {
      for (const ix of meteoraInstructions) {
        if (ix.data) {
          if (ix.data.startsWith(MeteoraParser.DISCRIMINATORS.ADD_LIQUIDITY)) {
            return this.parseAddLiquidity(transaction, tokenMint, feePayer);
          }
          if (ix.data.startsWith(MeteoraParser.DISCRIMINATORS.REMOVE_LIQUIDITY)) {
            return this.parseRemoveLiquidity(transaction, tokenMint, feePayer);
          }
        }
      }
    }

    return null; 
  }

  private parseAddLiquidity(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string
  ): Transaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers } = heliusTx;
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint && t.fromUserAccount === feePayer);
    const wsolTransfer = tokenTransfers?.find(t => t.mint === WSOL_MINT && t.fromUserAccount === feePayer);

    let tokenAmount = tokenTransfer?.tokenAmount || 0;
    let solAmount = wsolTransfer?.tokenAmount || 0;

    if (nativeTransfers) {
      for (const transfer of nativeTransfers) {
        if (transfer.fromUserAccount === feePayer) {
          solAmount += transfer.amount / 1e9;
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
    };
  }

  private parseRemoveLiquidity(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string
  ): Transaction | null {
    const { signature, timestamp, accountData, tokenTransfers: allTokenTransfers, nativeTransfers } = heliusTx;
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    let solAmount = 0;
    let tokenAmount = 0;
    let claimFeesAmount = 0;
    const tokenTransfers = allTokenTransfers || [];
    const wsolTransfersToUser: number[] = [];

    if (nativeTransfers) {
      for (const transfer of nativeTransfers) {
        if (transfer.toUserAccount === feePayer) {
          wsolTransfersToUser.push(transfer.amount / 1e9);
        }
      }
    }
    
    for (const transfer of tokenTransfers) {
      const isUserReceiving = transfer.toUserAccount === feePayer;
      
      if (isUserReceiving) {
        if (transfer.mint === WSOL_MINT) {
          wsolTransfersToUser.push(transfer.tokenAmount);
        } else if (transfer.mint === tokenMint) {
          tokenAmount += transfer.tokenAmount;
        }
      }
    }
    
    if (wsolTransfersToUser.length > 1) {
      wsolTransfersToUser.sort((a, b) => a - b);
      claimFeesAmount = wsolTransfersToUser[0]; 
      solAmount = wsolTransfersToUser.slice(1).reduce((sum, amt) => sum + amt, 0); 
    } else {
      solAmount = wsolTransfersToUser[0] || 0;
    }

    if (solAmount === 0 && accountData) {
      for (const accountChange of accountData) {
        if (accountChange.account === feePayer && accountChange.nativeBalanceChange) {
          const balanceChange = accountChange.nativeBalanceChange;
          if (balanceChange > 0) {
            solAmount = balanceChange / 1e9;
          }
        }
        
        if (accountChange.tokenBalanceChanges) {
          for (const balanceChange of accountChange.tokenBalanceChanges) {
            if (balanceChange.mint === tokenMint && balanceChange.rawTokenAmount) {
              const rawAmount = parseFloat(balanceChange.rawTokenAmount.tokenAmount);
              if (rawAmount > 0) {
                const decimals = balanceChange.rawTokenAmount.decimals || 6;
                tokenAmount += rawAmount / Math.pow(10, decimals);
              }
            } else if (balanceChange.mint === WSOL_MINT && balanceChange.rawTokenAmount && solAmount === 0) {
              const rawAmount = parseFloat(balanceChange.rawTokenAmount.tokenAmount);
              if (rawAmount > 0) {
                const decimals = balanceChange.rawTokenAmount.decimals || 9;
                solAmount += rawAmount / Math.pow(10, decimals);
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
    };
  }
}
