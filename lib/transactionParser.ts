import { Transaction, HeliusTransaction } from '../types';
import { PumpFunParser } from './parsers/pumpfun';
import { MeteoraParser } from './parsers/meteora';
import { DFlowParser } from './parsers/dflow';
import { JupiterParser } from './parsers/jupiter';
import { OKXParser } from './parsers/okx';
import { OnchainLabsParser } from './parsers/onchainlabs';
import { DexParser } from './parsers/base';

export class TransactionParser {
  private static parsers: DexParser[] = [
    new PumpFunParser(),
    new MeteoraParser(),
    new DFlowParser(),
    new JupiterParser(),
    new OKXParser(),
    new OnchainLabsParser(),
  ];

  static parse(heliusTx: HeliusTransaction, tokenMint: string): Transaction | null {
    // Try specific parsers first
    for (const parser of this.parsers) {
      if (parser.canParse(heliusTx)) {
        const result = parser.parse(heliusTx, tokenMint);
        if (result) return result;
      }
    }

    // Fallback to generic parsing logic (legacy)
    return this.parseGeneric(heliusTx, tokenMint);
  }

  static parseMultiple(heliusTxs: HeliusTransaction[], tokenMint: string): Transaction[] {
    return heliusTxs
      .map((tx) => this.parse(tx, tokenMint))
      .filter((tx): tx is Transaction => tx !== null);
  }

  // Legacy generic parser for unknown DEXes or simple transfers
  private static parseGeneric(heliusTx: HeliusTransaction, tokenMint: string): Transaction | null {
    try {
      const { signature, timestamp, tokenTransfers, nativeTransfers, accountData, type, feePayer, source } = heliusTx;

      // Check if this is a simple wallet-to-wallet transfer
      // Relaxed check: Accept any TRANSFER type, or specific sources known for transfers
      const isSimpleTransfer = type === 'TRANSFER' || type === 'transfer' || source === 'SOLANA_PROGRAM_LIBRARY' || source === 'SYSTEM_PROGRAM';
      
      if (isSimpleTransfer) {
        const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint);
        if (!tokenTransfer) return null;
        
        return {
          id: signature,
          signature,
          type: 'TRANSFER',
          wallet: tokenTransfer.fromUserAccount || feePayer || '',
          tokenAmount: tokenTransfer.tokenAmount || 0,
          solAmount: 0,
          timestamp: Date.now(),
          blockTime: timestamp,
          displayToken: 'Transfer',
          dex: source,
        };
      }

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
      
      let toAccount = tokenTransfer.toUserAccount;
      let fromAccount = tokenTransfer.fromUserAccount;
      
      if (!toAccount || toAccount === '') toAccount = feePayer || '';
      if (!fromAccount || fromAccount === '') fromAccount = feePayer || '';
      
      let isBuy: boolean;
      let actualWallet: string;

      // Use feePayer to identify the user
      if (feePayer && feePayer === toAccount) {
        isBuy = true;
        actualWallet = toAccount;
      } else if (feePayer && feePayer === fromAccount) {
        isBuy = false;
        actualWallet = fromAccount;
      } else {
        const isToUser = this.isUserAccount(toAccount);
        const isFromUser = this.isUserAccount(fromAccount);
        
        if (isToUser && !isFromUser) {
          isBuy = true;
          actualWallet = toAccount;
        } else if (isFromUser && !isToUser) {
          isBuy = false;
          actualWallet = fromAccount;
        } else {
          // Default to BUY if unclear
          isBuy = true;
          actualWallet = toAccount;
        }
      }

      // Find associated SOL or other token transfer
      let solAmount = 0;
      let displayToken = 'SOL';
      
      const WSOL_MINT = 'So11111111111111111111111111111111111111112';
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

      let usdcAmount = 0;
      let usdtAmount = 0;
      let wsolAmount = 0;

      if (tokenTransfers && tokenTransfers.length > 0) {
        for (const transfer of tokenTransfers) {
          if (transfer.mint === tokenMint) continue;

          const isRelevant = 
            (isBuy && transfer.fromUserAccount === actualWallet) || 
            (!isBuy && transfer.toUserAccount === actualWallet);

          if (isRelevant) {
            if (transfer.mint === USDC_MINT) usdcAmount += transfer.tokenAmount;
            else if (transfer.mint === USDT_MINT) usdtAmount += transfer.tokenAmount;
            else if (transfer.mint === WSOL_MINT) {
              wsolAmount += transfer.tokenAmount;
            }
          }
        }
        
        // Fallback: If no relevant WSOL found, check for any WSOL transfer
        if (wsolAmount === 0) {
           for (const transfer of tokenTransfers) {
             if (transfer.mint === WSOL_MINT) {
               if (transfer.tokenAmount > wsolAmount) {
                 wsolAmount = transfer.tokenAmount;
               }
             }
           }
        }
      }

      if (wsolAmount > 0) {
        solAmount = wsolAmount;
        displayToken = 'SOL';
      } else if (usdcAmount > 0) {
        solAmount = usdcAmount;
        displayToken = 'USDC';
      } else if (usdtAmount > 0) {
        solAmount = usdtAmount;
        displayToken = 'USDT';
      }

      if (solAmount === 0 && nativeTransfers && nativeTransfers.length > 0) {
        let totalNative = 0;
        for (const transfer of nativeTransfers) {
          if (isBuy) {
            if (transfer.fromUserAccount === actualWallet) totalNative += transfer.amount;
          } else {
            if (transfer.toUserAccount === actualWallet) totalNative += transfer.amount;
          }
        }
        solAmount = totalNative / 1e9;
      }

      // Determine DEX/Platform
      let dex = source || 'Unknown';
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
        solAmount: solAmount,
        displayToken,
        timestamp: Date.now(),
        blockTime: timestamp,
        dex,
        walletBalance: heliusTx.accountBalances?.[actualWallet],
      };
    } catch (error) {
      console.error('Error parsing generic transaction:', error);
      return null;
    }
  }

  private static isUserAccount(address: string) {
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
