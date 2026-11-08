import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';

export class OKXParser extends BaseParser {
  private static OKX_ROUTER_V2 = 'proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u';
  private static OKX_ROUTER_V1 = '6m2CDdhRgxpH4WjvdzxAYBGxwdnHkPsJwuDOj6mHEZn';
  private static OKX_ROUTER_ACCOUNT = 'ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn';
  private static OKX_AUTHORITY = 'HV1KXxWFaSeriyFvXyx48FqG9BoFbfinB8njCJonqP7K';

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction;
    return (
      instructions?.some((ix: any) => 
        ix.programId === OKXParser.OKX_ROUTER_V2 || 
        ix.programId === OKXParser.OKX_ROUTER_V1
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
    
    // Determine direction
    // If token is leaving a user account -> SELL
    // If token is entering a user account -> BUY
    
    // Helper to check if an address is a known system/router address
    const isRouter = (addr: string) => {
        return [
            OKXParser.OKX_ROUTER_V2, 
            OKXParser.OKX_ROUTER_V1,
            OKXParser.OKX_ROUTER_ACCOUNT,
            OKXParser.OKX_AUTHORITY,
            '8psNvWTrdNTiVRNzAgsou9kETXNJm2SXZyaKuJraVRtf' // Phantom Fees (often acts as relayer)
        ].includes(addr);
    };

    if (tokenTransfer.fromUserAccount && !isRouter(tokenTransfer.fromUserAccount)) {
        // If sent by a user (not router), it's a SELL
        type = 'SELL';
        wallet = tokenTransfer.fromUserAccount;
    } else if (tokenTransfer.toUserAccount && !isRouter(tokenTransfer.toUserAccount)) {
        // If received by a user (not router), it's a BUY
        type = 'BUY';
        wallet = tokenTransfer.toUserAccount;
    } else {
        // Fallback: use feePayer if it's not a router/relayer
        if (!isRouter(feePayer)) {
            wallet = feePayer;
            if (tokenTransfer.fromUserAccount === wallet) type = 'SELL';
            else if (tokenTransfer.toUserAccount === wallet) type = 'BUY';
        } else {
            // If feePayer IS a router/relayer (e.g. Phantom Fees), try to find the other party in native transfers
            // For SELL: User receives SOL
            // For BUY: User sends SOL
            // This is heuristic.
            if (nativeTransfers) {
                // Look for significant SOL transfer
                const userTransfer = nativeTransfers.find(t => !isRouter(t.toUserAccount) && !isRouter(t.fromUserAccount));
                if (userTransfer) {
                    wallet = userTransfer.toUserAccount; // Guess
                } else {
                    // Look for transfer FROM router TO user (SELL)
                    const fromRouter = nativeTransfers.find(t => isRouter(t.fromUserAccount) && !isRouter(t.toUserAccount));
                    if (fromRouter) {
                        wallet = fromRouter.toUserAccount;
                        type = 'SELL'; // Receiving SOL implies SELL
                    } else {
                        // Look for transfer FROM user TO router (BUY)
                        const toRouter = nativeTransfers.find(t => !isRouter(t.fromUserAccount) && isRouter(t.toUserAccount));
                        if (toRouter) {
                            wallet = toRouter.fromUserAccount;
                            type = 'BUY'; // Sending SOL implies BUY
                        }
                    }
                }
            }
        }
    }

    // Calculate SOL Amount
    let solAmount = 0;
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    // 1. Check for WSOL transfers
    if (tokenTransfers) {
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

    // 2. Check Native SOL transfers
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
            // Add native amount (converting lamports to SOL)
            // If we already have WSOL, we might be double counting if it's an unwrap.
            // But usually OKX/Aggregators handle this cleanly.
            // If solAmount is 0, definitely add.
            // If solAmount > 0, check if nativeAmount is similar? 
            // For now, let's add it if solAmount is 0, or if it seems distinct.
            // Simple heuristic: if solAmount is 0, take native.
            if (solAmount === 0) {
                solAmount += nativeAmount / 1e9;
            }
        }
    }

    // 3. Fallback: If SOL amount is still 0, check for intermediate WSOL transfers
    // This handles Token -> Token swaps where the route goes through SOL (Token A -> SOL -> Token B)
    if (solAmount === 0 && tokenTransfers) {
        // Try to find WSOL transfer matching the trade direction relative to Router
        // If BUY, we expect User -> Router (Router receives WSOL)
        // If SELL, we expect Router -> User (Router sends WSOL)
        const routerWSOL = tokenTransfers.find(t => {
            if (t.mint !== WSOL_MINT) return false;
            
            if (type === 'BUY') {
                return isRouter(t.toUserAccount);
            } else { // SELL
                return isRouter(t.fromUserAccount);
            }
        });

        if (routerWSOL) {
            solAmount = routerWSOL.tokenAmount;
        } else {
            // If strict direction check fails, try to find any WSOL transfer involving the router
            // This helps in complex routes where direction might be ambiguous
            const anyRouterWSOL = tokenTransfers.find(t => 
                t.mint === WSOL_MINT && (isRouter(t.fromUserAccount) || isRouter(t.toUserAccount))
            );
            if (anyRouterWSOL) {
                solAmount = anyRouterWSOL.tokenAmount;
            }
        }
    }

    return this.createTransaction(
        transaction,
        type,
        wallet,
        tokenTransfer.tokenAmount,
        tokenMint,
        'OKX DEX',
        solAmount
    );
  }
}
