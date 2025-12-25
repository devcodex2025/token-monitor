import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';
import bs58 from 'bs58';

export class JupiterParser extends BaseParser {
  private static JUPITER_V6_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
  private static JUPITER_LIMIT_ORDER_PROGRAM_ID = 'j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X';

  private decodeLimitOrderData(data: string): { makingAmount: bigint, takingAmount: bigint } | null {
    try {
        const buffer = bs58.decode(data);
        // Expecting at least 32 bytes for the data structure we identified
        // 0-7: Discriminator
        // 8-15: Unknown
        // 16-23: Making Amount
        // 24-31: Taking Amount
        if (buffer.length < 32) return null;
        
        const makingAmount = buffer.readBigUInt64LE(16);
        const takingAmount = buffer.readBigUInt64LE(24);
        
        return { makingAmount, takingAmount };
    } catch (e) {
        return null;
    }
  }

  private calculateSwapValue(
    transaction: HeliusTransaction, 
    wallet: string, 
    type: 'BUY' | 'SELL', 
    tokenMint: string
  ): { solAmount: number, displayToken: string, score: number } {
    const { tokenTransfers, nativeTransfers, instructions } = transaction;
    let solAmount = 0;
    let displayToken = 'SOL';
    let score = 0; // 0: None, 1: Unknown, 2: Stable, 3: SOL/WSOL

    const WSOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

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
    if (solAmount > 0) score = 3;

    // 2. If no WSOL, check Native SOL transfers
    if (nativeTransfers) {
        let nativeAmount = 0;
        for (const transfer of nativeTransfers) {
            if (type === 'SELL' && transfer.toUserAccount === wallet) {
                nativeAmount += transfer.amount;
            } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                nativeAmount += transfer.amount;
            }
        }
        if (nativeAmount > 0) {
            // Only add if we haven't found WSOL (or if it's likely an unwrap/wrap)
            // For simplicity, if we already have WSOL, we assume that's the swap value.
            // But sometimes native SOL is used directly.
            if (score < 3) {
                solAmount += nativeAmount / 1e9;
                score = 3;
            }
        }
    }

    // 3. Check inner instructions for System Program transfers (fallback for SOL)
    if (score < 3 && instructions) {
        const jupiterInstruction = instructions.find((ix: any) => 
            ix.programId === JupiterParser.JUPITER_V6_PROGRAM_ID ||
            ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID
        );

        if (jupiterInstruction && jupiterInstruction.innerInstructions) {
            for (const inner of jupiterInstruction.innerInstructions) {
                if (inner.programId === '11111111111111111111111111111111') { // System Program
                    try {
                        const data = Buffer.from(bs58.decode(inner.data));
                        if (data.length >= 12) {
                            const instructionIndex = data.readUInt32LE(0);
                            if (instructionIndex === 2) { // Transfer
                                const amount = Number(data.readBigUInt64LE(4));
                                const source = inner.accounts[0];
                                const dest = inner.accounts[1];
                                
                                if (type === 'BUY') {
                                    if (source === wallet) {
                                        solAmount += amount / 1e9;
                                        score = 3;
                                    }
                                } else { // SELL
                                    if (dest === wallet) {
                                        solAmount += amount / 1e9;
                                        score = 3;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }
    }

    // 4. Check for other tokens
    if (score === 0 && tokenTransfers) {
        for (const transfer of tokenTransfers) {
            if (transfer.mint === tokenMint) continue;
            if (transfer.mint === WSOL_MINT) continue;

            let amount = 0;
            if (type === 'SELL' && transfer.toUserAccount === wallet) {
                amount = transfer.tokenAmount;
            } else if (type === 'BUY' && transfer.fromUserAccount === wallet) {
                amount = transfer.tokenAmount;
            }

            if (amount > 0) {
                solAmount = amount;
                if (transfer.mint === USDC_MINT) {
                    displayToken = 'USDC';
                    score = 2;
                } else if (transfer.mint === USDT_MINT) {
                    displayToken = 'USDT';
                    score = 2;
                } else {
                    displayToken = 'UNKNOWN';
                    score = 1;
                }
                break; // Take the first one found
            }
        }
    }

    return { solAmount, displayToken, score };
  }

  canParse(transaction: HeliusTransaction): boolean {
    const { instructions } = transaction;
    return (
      instructions?.some((ix: any) => 
        ix.programId === JupiterParser.JUPITER_V6_PROGRAM_ID ||
        ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID
      ) || false
    );
  }

  parse(transaction: HeliusTransaction, tokenMint: string): Transaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers, feePayer, instructions, accountData } = transaction;

    // Find all transfers for the monitored token
    let relevantTransfers = tokenTransfers?.filter(t => t.mint === tokenMint) || [];
    
    // Fallback: If no token transfers found, check accountData for balance changes
    if (relevantTransfers.length === 0 && accountData) {
        const accountChanges = accountData.filter(ad => 
            ad.tokenBalanceChanges?.some(tbc => tbc.mint === tokenMint)
        );
        
        if (accountChanges.length > 0) {
            relevantTransfers = accountChanges.flatMap(ad => {
                const change = ad.tokenBalanceChanges!.find(tbc => tbc.mint === tokenMint)!;
                if (!change.rawTokenAmount) return [];
                
                const rawAmount = change.rawTokenAmount;
                const amount = parseFloat(rawAmount.tokenAmount) / Math.pow(10, rawAmount.decimals);
                
                if (amount === 0) return [];

                // Create virtual transfer
                if (amount < 0) {
                    return [{
                        fromUserAccount: change.userAccount || ad.account,
                        toUserAccount: '', 
                        tokenAmount: Math.abs(amount),
                        mint: tokenMint,
                        tokenStandard: 'Fungible'
                    }];
                } else {
                    return [{
                        fromUserAccount: '', 
                        toUserAccount: change.userAccount || ad.account,
                        tokenAmount: amount,
                        mint: tokenMint,
                        tokenStandard: 'Fungible'
                    }];
                }
            });
        }
    }

    if (relevantTransfers.length === 0) return null;

    let wallet = feePayer || '';
    let type: 'BUY' | 'SELL' | 'TRANSFER' = 'BUY';
    let tokenAmount = 0;
    let solAmount = 0;
    let displayToken = 'SOL';
    let dex = 'Jupiter';

    // Check for Limit Order
    const isLimitOrder = instructions?.some((ix: any) => ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID);
    
    if (isLimitOrder) {
        // Check if it's a cancel order (user receiving tokens back)
        const incoming = relevantTransfers.filter(t => t.toUserAccount === feePayer);
        if (incoming.length > 0) {
            type = 'TRANSFER';
            wallet = feePayer;
            tokenAmount = incoming.reduce((sum, t) => sum + t.tokenAmount, 0);
            displayToken = 'Cancel Order';
            dex = 'Jupiter Limit Order';
            
            return {
                id: signature,
                signature,
                type,
                wallet,
                tokenAmount,
                solAmount: 0,
                timestamp: Date.now(),
                blockTime: timestamp,
                displayToken,
                dex,
            };
        }

        // Check if it's a create order (user sending tokens)
        const outgoing = relevantTransfers.filter(t => t.fromUserAccount === feePayer);
        if (outgoing.length > 0) {
            const limitOrderIx = instructions?.find((ix: any) => ix.programId === JupiterParser.JUPITER_LIMIT_ORDER_PROGRAM_ID);
            let orderSolAmount = 0;

            if (limitOrderIx) {
                const decoded = this.decodeLimitOrderData(limitOrderIx.data);
                if (decoded) {
                    // Check if taking mint is SOL/WSOL
                    // Assuming index 8 is taking mint based on the example.
                    const accounts = limitOrderIx.accounts;
                    if (accounts && accounts.length > 8) {
                        const takingMint = accounts[8];
                        const WSOL_MINT = 'So11111111111111111111111111111111111111112';
                        
                        if (takingMint === WSOL_MINT) {
                             const quoteAmount = Number(decoded.takingAmount);
                             orderSolAmount = quoteAmount / 1e9;
                        }
                    }
                }
            }

            type = 'SELL';
            wallet = feePayer;
            tokenAmount = outgoing.reduce((sum, t) => sum + t.tokenAmount, 0);
            dex = 'Jupiter Limit Order';
            
            return {
                id: signature,
                signature,
                type,
                wallet,
                tokenAmount,
                solAmount: orderSolAmount,
                timestamp: Date.now(),
                blockTime: timestamp,
                displayToken,
                dex,
            };
        }
    }

    // Identify candidates based on token transfers
    const candidates: { wallet: string, type: 'BUY' | 'SELL', tokenAmount: number, solAmount: number, displayToken: string, score: number }[] = [];
    const wallets = new Set<string>();
    relevantTransfers.forEach(t => {
        if (t.toUserAccount) wallets.add(t.toUserAccount);
        if (t.fromUserAccount) wallets.add(t.fromUserAccount);
    });

    for (const candidateWallet of wallets) {
        // Check BUY (receiving token)
        const incoming = relevantTransfers.filter(t => t.toUserAccount === candidateWallet);
        if (incoming.length > 0) {
            const amount = incoming.reduce((sum, t) => sum + t.tokenAmount, 0);
            const { solAmount, displayToken, score } = this.calculateSwapValue(transaction, candidateWallet, 'BUY', tokenMint);
            candidates.push({ wallet: candidateWallet, type: 'BUY', tokenAmount: amount, solAmount, displayToken, score });
        }

        // Check SELL (sending token)
        const outgoing = relevantTransfers.filter(t => t.fromUserAccount === candidateWallet);
        if (outgoing.length > 0) {
            const amount = outgoing.reduce((sum, t) => sum + t.tokenAmount, 0);
            const { solAmount, displayToken, score } = this.calculateSwapValue(transaction, candidateWallet, 'SELL', tokenMint);
            candidates.push({ wallet: candidateWallet, type: 'SELL', tokenAmount: amount, solAmount, displayToken, score });
        }
    }

    // Sort candidates to find the best match
    candidates.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score; // Higher score first (SOL > Stable > Unknown > None)
        if (Math.abs(a.solAmount - b.solAmount) > 1e-9) return b.solAmount - a.solAmount; // Higher value first
        // Prefer BUY over SELL if everything else is equal
        if (a.type === 'BUY' && b.type === 'SELL') return -1;
        if (a.type === 'SELL' && b.type === 'BUY') return 1;
        // Prefer feePayer if everything else is equal
        if (a.wallet === feePayer) return -1;
        if (b.wallet === feePayer) return 1;
        return 0;
    });

    const best = candidates[0];
    if (best) {
        wallet = best.wallet;
        type = best.type;
        tokenAmount = best.tokenAmount;
        solAmount = best.solAmount;
        displayToken = best.displayToken;
    } else {
        // Fallback if no candidates found (unlikely given relevantTransfers check)
        wallet = feePayer;
    }

    return {
        id: signature,
        signature,
        type,
        wallet,
        tokenAmount,
        solAmount,
        timestamp: Date.now(),
        blockTime: timestamp,
        displayToken,
        dex,
    };
  }
}
