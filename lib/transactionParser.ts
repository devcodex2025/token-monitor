import { Transaction, HeliusTransaction } from '@/types';

export class TransactionParser {
  static parse(heliusTx: HeliusTransaction, tokenMint: string): Transaction | null {
    try {
      const { signature, timestamp, tokenTransfers, nativeTransfers, accountData, type, feePayer, source } = heliusTx;

      if (!tokenTransfers || tokenTransfers.length === 0) {
        return null;
      }

      // Find token transfer for our mint
      const tokenTransfer = tokenTransfers.find(
        (transfer) => transfer.mint === tokenMint
      );

      if (!tokenTransfer) {
        return null;
      }

      // Simple swap direction logic:
      // BUY = any token X → our token (someone receives our token)
      // SELL = our token → any token X (someone sends our token)
      
      const toAccount = tokenTransfer.toUserAccount;
      const fromAccount = tokenTransfer.fromUserAccount;
      
      let isBuy: boolean;
      let actualWallet: string;

      // Use feePayer to identify the user
      if (feePayer && feePayer === toAccount) {
        // Fee payer receives our token = BUY
        isBuy = true;
        actualWallet = toAccount;
      } else if (feePayer && feePayer === fromAccount) {
        // Fee payer sends our token = SELL
        isBuy = false;
        actualWallet = fromAccount;
      } else {
        const isToUser = this.isUserAccount(toAccount);
        const isFromUser = this.isUserAccount(fromAccount);
        
        // Primary logic: check if real user is receiving or sending our token
        if (isToUser && !isFromUser) {
          // User receives our token = BUY
          isBuy = true;
          actualWallet = toAccount;
        } else if (isFromUser && !isToUser) {
          // User sends our token = SELL
          isBuy = false;
          actualWallet = fromAccount;
        } else {
        // Fallback: look at opposite token flow direction
        // If opposite token flows FROM toAccount → toAccount is buying (BUY)
        // If opposite token flows TO toAccount → toAccount is selling (SELL)
        
        let hasOppositeFrom = false;
        let hasOppositeTo = false;
        
        // Check SOL transfers
        if (nativeTransfers && nativeTransfers.length > 0) {
          for (const transfer of nativeTransfers) {
            if (transfer.fromUserAccount === toAccount) hasOppositeFrom = true;
            if (transfer.toUserAccount === toAccount) hasOppositeTo = true;
          }
        }
        
        // Check other token transfers
        if (tokenTransfers && tokenTransfers.length > 1) {
          for (const transfer of tokenTransfers) {
            if (transfer.mint !== tokenMint) {
              if (transfer.fromUserAccount === toAccount) hasOppositeFrom = true;
              if (transfer.toUserAccount === toAccount) hasOppositeTo = true;
            }
          }
        }
        
        // Determine direction based on opposite flow
        if (hasOppositeFrom && !hasOppositeTo) {
          // Other asset leaves toAccount, our token arrives = BUY
          isBuy = true;
          actualWallet = toAccount;
        } else if (hasOppositeTo && !hasOppositeFrom) {
          // Other asset arrives toAccount, our token leaves = SELL
          isBuy = false;
          actualWallet = fromAccount;
        } else {
          // Default to BUY if unclear
          isBuy = true;
          actualWallet = toAccount;
        }
      }
      }

      // Find associated SOL or other token transfer (USDC, USDT, etc)
      let solAmount = 0;
      let displayToken = 'SOL';
      
      if (nativeTransfers && nativeTransfers.length > 0) {
        // For BUY: user sends SOL (fromUserAccount)
        // For SELL: user receives SOL (toUserAccount)
        const relevantTransfer = nativeTransfers.find(
          (transfer) => {
            if (isBuy) {
              return transfer.fromUserAccount === actualWallet;
            } else {
              return transfer.toUserAccount === actualWallet;
            }
          }
        );
        
        if (relevantTransfer) {
          solAmount = relevantTransfer.amount;
        } else {
          // Fallback: find any SOL transfer related to this wallet
          const anyTransfer = nativeTransfers.find(
            (transfer) =>
              transfer.fromUserAccount === actualWallet || transfer.toUserAccount === actualWallet
          );
          if (anyTransfer) {
            solAmount = anyTransfer.amount;
          }
        }
      }
      
      // If no SOL amount found or it's zero, look for other token transfers (USDC, USDT, etc)
      if (solAmount === 0 && tokenTransfers && tokenTransfers.length > 1) {
        // Find the opposite token transfer (the one that's NOT our token)
        const otherTokenTransfer = tokenTransfers.find(
          (transfer) => transfer.mint !== tokenMint && (
            (isBuy && transfer.fromUserAccount === actualWallet) ||
            (!isBuy && transfer.toUserAccount === actualWallet)
          )
        );
        
        if (otherTokenTransfer) {
          solAmount = otherTokenTransfer.tokenAmount;
          // Try to identify the token symbol
          const knownTokens: Record<string, string> = {
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
            'So11111111111111111111111111111111111111112': 'SOL',
          };
          displayToken = knownTokens[otherTokenTransfer.mint] || 'TOKEN';
        }
      }

      // Determine DEX/Platform
      let dex = source || 'Unknown';
      
      // Check for specific program IDs if source is generic or unknown
      if (accountData) {
        const programMap: Record<string, string> = {
          'boop8hVGQGqehUK2iVEMEnMrL5RbjywRzHKBmBE7ry4': 'Boop.fun',
          '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
          'MoonCVVNZFSYkqN5438hi3fulh6Nj59sbpxmaxhY9Q': 'Moonshot',
        };

        for (const acc of accountData) {
          if (programMap[acc.account]) {
            dex = programMap[acc.account];
            break;
          }
        }
      }

      return {
        id: signature,
        signature,
        type: isBuy ? 'BUY' : 'SELL',
        wallet: actualWallet,
        tokenAmount: tokenTransfer.tokenAmount,
        solAmount,
        displayToken,
        timestamp: Date.now(),
        blockTime: timestamp,
        dex,
      };
    } catch (error) {
      console.error('Error parsing transaction:', error);
      return null;
    }
  }

  // Helper to determine if an account is likely a user (not a program/pool)
  private static isUserAccount(address: string): boolean {
    // Common program/system accounts to exclude
    const knownPrograms = [
      '11111111111111111111111111111111', // System Program
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
      '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', // Pump.fun
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
    ];
    
    return !knownPrograms.includes(address);
  }

  static parseMultiple(heliusTxs: HeliusTransaction[], tokenMint: string): Transaction[] {
    return heliusTxs
      .map((tx) => this.parse(tx, tokenMint))
      .filter((tx): tx is Transaction => tx !== null);
  }
}
