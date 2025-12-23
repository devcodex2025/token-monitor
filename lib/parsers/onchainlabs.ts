import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';

export class OnchainLabsParser extends BaseParser {
  private static PROGRAM_ID = 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ';

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction;
    return (
      instructions?.some((ix: any) => 
        ix.programId === OnchainLabsParser.PROGRAM_ID ||
        ix.innerInstructions?.some((inner: any) => inner.programId === OnchainLabsParser.PROGRAM_ID)
      ) || false
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
    if (tokenTransfer.fromUserAccount === feePayer) {
        type = 'SELL';
        wallet = feePayer;
    } else if (tokenTransfer.toUserAccount === feePayer) {
        type = 'BUY';
        wallet = feePayer;
    } else {
        // Fallback: try to infer from transfer direction relative to known accounts
        // If token is leaving a user account, it's a SELL
        // If token is entering a user account, it's a BUY
        // We assume the "UserAccount" fields in tokenTransfers are populated correctly by Helius
        if (tokenTransfer.fromUserAccount && tokenTransfer.fromUserAccount !== OnchainLabsParser.PROGRAM_ID) {
             // Likely the user
             wallet = tokenTransfer.fromUserAccount;
             type = 'SELL';
        } else if (tokenTransfer.toUserAccount && tokenTransfer.toUserAccount !== OnchainLabsParser.PROGRAM_ID) {
             wallet = tokenTransfer.toUserAccount;
             type = 'BUY';
        }
    }

    // Calculate SOL Amount
    let solAmount = 0;

    // Check for WSOL transfers first (common in DEX swaps)
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';
    if (tokenTransfers) {
        // First pass: check for direct user involvement
        for (const transfer of tokenTransfers) {
            if (transfer.mint === WSOL_MINT) {
                if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                    solAmount += transfer.tokenAmount;
                } else if (type === 'SELL' && transfer.toUserAccount === wallet) {
                    solAmount += transfer.tokenAmount;
                }
            }
        }

        // Second pass: if 0, check for any significant WSOL transfer (likely the router/pool)
        if (solAmount === 0) {
             for (const transfer of tokenTransfers) {
                if (transfer.mint === WSOL_MINT) {
                    // We take the largest WSOL transfer as the likely swap value
                    // This is a heuristic but works for most router-based swaps where user doesn't touch WSOL
                    if (transfer.tokenAmount > solAmount) {
                        solAmount = transfer.tokenAmount;
                    }
                }
            }
        }
    }

    // If no WSOL, check native transfers
    if (solAmount === 0 && nativeTransfers) {
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
        // Use the one that matches the direction
        if (type === 'BUY') {
            solAmount = sent / 1e9;
        } else {
            solAmount = received / 1e9;
        }
        
        // If still 0 or ambiguous, maybe use max like DFlow?
        // But usually direction is clear.
        if (solAmount === 0) {
             solAmount = Math.max(sent, received) / 1e9;
        }
    }

    return this.createTransaction(
        transaction,
        type,
        wallet,
        tokenTransfer.tokenAmount,
        tokenMint,
        'Onchain Labs',
        solAmount
    );
  }
}
