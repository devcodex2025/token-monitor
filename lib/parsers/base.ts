
import { HeliusTransaction, Transaction } from '../../types';

export interface DexParser {
  canParse(transaction: HeliusTransaction): boolean;
  parse(transaction: HeliusTransaction, tokenMint: string): Transaction | null;
}

export abstract class BaseParser implements DexParser {
  abstract canParse(transaction: HeliusTransaction): boolean;
  abstract parse(transaction: HeliusTransaction, tokenMint: string): Transaction | null;

  protected createTransaction(
    heliusTx: HeliusTransaction,
    type: 'BUY' | 'SELL' | 'ADD_LIQUIDITY' | 'REMOVE_LIQUIDITY' | 'CLAIM_FEES' | 'TRANSFER',
    wallet: string,
    tokenAmount: number,
    tokenMint: string,
    dex: string,
    solAmountOverride?: number
  ): Transaction {
    const { signature, timestamp, nativeTransfers, tokenTransfers } = heliusTx;
    let solAmount = solAmountOverride || 0;
    const displayToken = 'SOL';

    // Calculate SOL amount if not provided
    if (solAmount === 0) {
      if (nativeTransfers) {
        for (const transfer of nativeTransfers) {
          // For BUY: User pays SOL. Sum transfers FROM wallet.
          // For SELL: User receives SOL. Sum transfers TO wallet.
          if (type === 'BUY') {
            if (transfer.fromUserAccount === wallet && transfer.toUserAccount !== wallet) {
              solAmount += transfer.amount;
            }
          } else if (type === 'SELL') {
            if (transfer.toUserAccount === wallet && transfer.fromUserAccount !== wallet) {
              solAmount += transfer.amount;
            }
          }
        }
        solAmount = solAmount / 1e9;
      }

      // If no native SOL, check for WSOL
      if (solAmount === 0 && tokenTransfers) {
        const WSOL_MINT = 'So11111111111111111111111111111111111111112';
        for (const transfer of tokenTransfers) {
          if (transfer.mint === WSOL_MINT) {
             let isRelevant = (type === 'BUY' && transfer.fromUserAccount === wallet) ||
                                (type === 'SELL' && transfer.toUserAccount === wallet);
             
             // Fallback: Check feePayer if wallet is different
             // This handles cases where the "wallet" identified (e.g. from token transfer) 
             // is different from the account paying/receiving the SOL (e.g. fee payer)
             if (!isRelevant && heliusTx.feePayer) {
                 isRelevant = (type === 'BUY' && transfer.fromUserAccount === heliusTx.feePayer) ||
                              (type === 'SELL' && transfer.toUserAccount === heliusTx.feePayer);
             }

             if (isRelevant) {
               solAmount += transfer.tokenAmount;
             }
          }
        }

        // Global Fallback: If still 0, take the largest WSOL transfer
        // This handles complex routing where wallet/feePayer matching fails
        if (solAmount === 0) {
             let maxAmount = 0;
             for (const transfer of tokenTransfers) {
                 if (transfer.mint === WSOL_MINT) {
                     if (transfer.tokenAmount > maxAmount) {
                         maxAmount = transfer.tokenAmount;
                     }
                 }
             }
             solAmount = maxAmount;
        }
      }

      // Fallback: Check accountData for balance changes
      if (solAmount === 0 && heliusTx.accountData) {
        const userAccountData = heliusTx.accountData.find(a => a.account === wallet);
        if (userAccountData && userAccountData.nativeBalanceChange) {
          const change = userAccountData.nativeBalanceChange;
          if (type === 'BUY' && change < 0) {
            solAmount = Math.abs(change) / 1e9;
          } else if (type === 'SELL' && change > 0) {
            solAmount = change / 1e9;
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
    };
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
    ];
    return !knownPrograms.includes(address);
  }
}
