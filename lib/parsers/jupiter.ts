import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';

export class JupiterParser extends BaseParser {
  private static JUPITER_V6_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction;
    return (
      instructions?.some((ix: any) => ix.programId === JupiterParser.JUPITER_V6_PROGRAM_ID) ||
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
    
    // Determine direction based on token flow relative to feePayer (User)
    // If user is sending the token -> SELL
    // If user is receiving the token -> BUY
    if (tokenTransfer.fromUserAccount === feePayer) {
        type = 'SELL';
        wallet = feePayer;
    } else if (tokenTransfer.toUserAccount === feePayer) {
        type = 'BUY';
        wallet = feePayer;
    } else {
        // Fallback: If feePayer is not directly involved in the token transfer
        // Check which account is involved in native transfers (paying/receiving SOL)
        const fromInvolved = nativeTransfers?.some(t => t.fromUserAccount === tokenTransfer.fromUserAccount || t.toUserAccount === tokenTransfer.fromUserAccount);
        const toInvolved = nativeTransfers?.some(t => t.fromUserAccount === tokenTransfer.toUserAccount || t.toUserAccount === tokenTransfer.toUserAccount);

        if (fromInvolved && !toInvolved) {
            wallet = tokenTransfer.fromUserAccount;
            type = 'SELL';
        } else if (toInvolved && !fromInvolved) {
            wallet = tokenTransfer.toUserAccount;
            type = 'BUY';
        }
    }

    // Calculate SOL Amount
    // Jupiter swaps often involve WSOL or Native SOL.
    // We need to capture the value of the trade in SOL.
    let solAmount = 0;
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    // 1. Check for WSOL transfers
    if (tokenTransfers) {
        for (const transfer of tokenTransfers) {
            if (transfer.mint === WSOL_MINT) {
                // For SELL: User receives WSOL
                if (type === 'SELL' && transfer.toUserAccount === wallet) {
                    solAmount += transfer.tokenAmount;
                }
                // For BUY: User sends WSOL
                else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                    solAmount += transfer.tokenAmount;
                }
            }
        }
    }

    // 2. If no WSOL (or mixed), check Native SOL transfers
    // Note: Jupiter often unwraps WSOL to SOL at the end of a swap.
    if (nativeTransfers) {
        let nativeAmount = 0;
        for (const transfer of nativeTransfers) {
            if (type === 'SELL') {
                if (transfer.toUserAccount === wallet) {
                    nativeAmount += transfer.amount;
                }
            } else if (type === 'BUY') {
                if (transfer.fromUserAccount === wallet) {
                    nativeAmount += transfer.amount;
                }
            }
        }
        if (nativeAmount > 0) {
            // If we found native SOL, add it. 
            // Be careful not to double count if WSOL was unwrapped.
            // Usually if there is a WSOL transfer AND a Native transfer of similar amount, it's an unwrap.
            // If solAmount (WSOL) is already > 0, we might want to ignore native if it's just the unwrap.
            // But if solAmount is 0, we definitely take native.
            if (solAmount === 0) {
                solAmount += nativeAmount / 1e9;
            }
        }
    }

    return this.createTransaction(
        transaction,
        type,
        wallet,
        tokenTransfer.tokenAmount,
        tokenMint,
        'Jupiter',
        solAmount
    );
  }
}
