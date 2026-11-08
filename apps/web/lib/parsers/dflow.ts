import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';

export class DFlowParser extends BaseParser {
  private static DFLOW_PROGRAM_ID = 'DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH';

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction;
    return (
      instructions?.some((ix: any) => ix.programId === DFlowParser.DFLOW_PROGRAM_ID) ||
      false
    );
  }

  parse(transaction: HeliusTransaction, tokenMint: string): Transaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers, feePayer } = transaction;

    // Find the transfer for the monitored token
    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint);
    if (!tokenTransfer) return null;

    let wallet = feePayer || '';
    let type: 'BUY' | 'SELL' = 'BUY';
    
    // Determine direction and wallet
    // If feePayer is involved in the transfer, use feePayer
    if (tokenTransfer.fromUserAccount === feePayer) {
        type = 'SELL';
        wallet = feePayer;
    } else if (tokenTransfer.toUserAccount === feePayer) {
        type = 'BUY';
        wallet = feePayer;
    } else {
        // Fallback: assume the user is the one interacting with the token
        // If the token is leaving an account, that account is likely the user (SELL)
        // If the token is entering an account, that account is likely the user (BUY)
        // But we need to distinguish from the pool/router.
        // Usually the router is not the fee payer.
        // Let's assume feePayer is the user for now as it's most common.
        if (tokenTransfer.fromUserAccount) {
             // Check if fromUserAccount is a PDA or System Program? 
             // For now, default to feePayer logic or generic logic.
             // If we can't match feePayer, we might skip or guess.
        }
    }

    // Calculate SOL Amount
    // DFlow often does Token -> SOL -> Token swaps.
    // We want the SOL value of the trade.
    let solAmount = 0;

    if (nativeTransfers) {
        let sent = 0;
        let received = 0;
        for (const transfer of nativeTransfers) {
            if (transfer.fromUserAccount === wallet) {
                sent += transfer.amount;
            }
            if (transfer.toUserAccount === wallet) {
                received += transfer.amount;
            }
        }
        // Use the maximum of sent/received to capture the SOL value moving through the user's wallet
        // This handles cases where SOL is intermediate (Token -> SOL -> Token) and the user forwards it.
        solAmount = Math.max(sent, received) / 1e9;
    }

    // If SOL amount is still 0 (e.g. pure Token-Token swap with no intermediate SOL visible in native transfers),
    // we might check for WSOL transfers.
    // Also, if we have WSOL transfers, we should prioritize them over USDC if the user wants to see SOL value.
    // In DFlow, often USDC -> WSOL -> Token. We want the WSOL amount that was swapped for the token.
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';
    let wsolAmount = 0;
    
    if (tokenTransfers) {
        for (const transfer of tokenTransfers) {
            if (transfer.mint === WSOL_MINT) {
                if (type === 'SELL' && transfer.toUserAccount === wallet) {
                    wsolAmount += transfer.tokenAmount;
                } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                    wsolAmount += transfer.tokenAmount;
                }
            }
        }
    }
    
    if (wsolAmount > 0) {
        solAmount = wsolAmount;
    } else if (solAmount === 0 && tokenTransfers) {
        // Fallback to previous logic if no WSOL found
        for (const transfer of tokenTransfers) {
            if (transfer.mint === WSOL_MINT) {
                if (type === 'SELL' && transfer.toUserAccount === wallet) {
                    solAmount += transfer.tokenAmount;
                } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                    solAmount += transfer.tokenAmount;
                }
            }
        }
    }

    let displayToken = 'SOL';
    
    // Check for USDC/USDT if SOL amount is negligible (likely just rent or fees)
    if (solAmount < 0.01 && tokenTransfers) {
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
        
        let totalUsdc = 0;
        let totalUsdt = 0;

        for (const transfer of tokenTransfers) {
            if (transfer.mint === USDC_MINT) {
                if (type === 'SELL' && transfer.toUserAccount === wallet) {
                    totalUsdc += transfer.tokenAmount;
                } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                    totalUsdc += transfer.tokenAmount;
                }
            } else if (transfer.mint === USDT_MINT) {
                if (type === 'SELL' && transfer.toUserAccount === wallet) {
                    totalUsdt += transfer.tokenAmount;
                } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                    totalUsdt += transfer.tokenAmount;
                }
            }
        }
        
        if (totalUsdc > 0) {
            solAmount = totalUsdc;
            displayToken = 'USDC';
        } else if (totalUsdt > 0) {
            solAmount = totalUsdt;
            displayToken = 'USDT';
        }
    }

    return this.createTransaction(
        transaction,
        type,
        wallet,
        tokenTransfer.tokenAmount,
        tokenMint,
        'DFlow',
        solAmount,
        displayToken
    );
  }
}
