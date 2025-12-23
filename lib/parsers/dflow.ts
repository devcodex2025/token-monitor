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
    if (solAmount === 0 && tokenTransfers) {
        const WSOL_MINT = 'So11111111111111111111111111111111111111112';
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

    return this.createTransaction(
        transaction,
        type,
        wallet,
        tokenTransfer.tokenAmount,
        tokenMint,
        'DFlow',
        solAmount
    );
  }
}
