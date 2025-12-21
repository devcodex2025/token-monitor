import { Transaction, HeliusTransaction } from '../types';

export class TransactionParser {

  static parseAddLiquidity(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string
  ): Transaction | null {
    const { signature, timestamp, tokenTransfers, nativeTransfers } = heliusTx;
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    // Find the transfers going FROM user TO pool
    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint && t.fromUserAccount === feePayer);
    const wsolTransfer = tokenTransfers?.find(t => t.mint === WSOL_MINT && t.fromUserAccount === feePayer);

    let tokenAmount = tokenTransfer?.tokenAmount || 0;
    let solAmount = wsolTransfer?.tokenAmount || 0;

    // Check Native Transfers (SOL)
    if (nativeTransfers) {
      for (const transfer of nativeTransfers) {
        if (transfer.fromUserAccount === feePayer) {
          // Native transfers are in lamports, convert to SOL
          // Note: User might send multiple native transfers (e.g. to WSOL account, to Fee account)
          // We should probably sum them up, or try to identify the one to the pool?
          // For simplicity, let's sum all native transfers FROM user that are large enough to be liquidity?
          // Or just sum all.
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
      timestamp,
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'Meteora',
    };
  }

  static parseClaimFees(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    feePayer: string
  ): Transaction | null {
    const { signature, timestamp, tokenTransfers } = heliusTx;
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    // Find the transfers
    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint);
    const wsolTransfer = tokenTransfers?.find(t => t.mint === WSOL_MINT);

    const tokenAmount = tokenTransfer?.tokenAmount || 0;
    const solAmount = wsolTransfer?.tokenAmount || 0;

    return {
      id: signature,
      signature,
      type: 'CLAIM_FEES',
      wallet: feePayer || '',
      tokenAmount,
      solAmount,
      timestamp,
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'Meteora',
    };
  }

  static parseRemoveLiquidity(
    heliusTx: HeliusTransaction,
    tokenMint: string,
    tokenTransfer: any,
    feePayer: string
  ): Transaction | null {
    const { signature, timestamp, accountData, tokenTransfers: allTokenTransfers, nativeTransfers } = heliusTx;
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';

    // Find transfers going TO the user (receiving tokens back)
    let solAmount = 0;
    let tokenAmount = 0;
    let claimFeesAmount = 0;
    const tokenTransfers = allTokenTransfers || [];
    
    // Collect WSOL transfers to detect combined Remove Liquidity + Claim Fees
    const wsolTransfersToUser: number[] = [];

    // Check Native Transfers (SOL)
    if (nativeTransfers) {
      for (const transfer of nativeTransfers) {
        if (transfer.toUserAccount === feePayer) {
          // Native transfers are in lamports, convert to SOL
          wsolTransfersToUser.push(transfer.amount / 1e9);
        }
      }
    }
    
    // Collect ALL transfers going TO user (might include both liquidity + fees)
    for (const transfer of tokenTransfers) {
      // Check if user is receiving (toUserAccount matches feePayer)
      const isUserReceiving = transfer.toUserAccount === feePayer;
      
      if (isUserReceiving) {
        if (transfer.mint === WSOL_MINT) {
          wsolTransfersToUser.push(transfer.tokenAmount);
        } else if (transfer.mint === tokenMint) {
          tokenAmount += transfer.tokenAmount;
        }
      }
    }
    
    // If multiple WSOL transfers, the smallest one is likely Claim Fees
    if (wsolTransfersToUser.length > 1) {
      // Sort to find smallest
      wsolTransfersToUser.sort((a, b) => a - b);
      claimFeesAmount = wsolTransfersToUser[0]; // Smallest = fees
      solAmount = wsolTransfersToUser.slice(1).reduce((sum, amt) => sum + amt, 0); // Rest = liquidity
    } else {
      // Single WSOL transfer = just liquidity
      solAmount = wsolTransfersToUser[0] || 0;
    }

    // If we didn't find SOL in tokenTransfers, check accountData for user's balance change
    if (solAmount === 0 && accountData) {
      for (const accountChange of accountData) {
        // Check if this is the user's account
        if (accountChange.account === feePayer && accountChange.nativeBalanceChange) {
          // Convert lamports to SOL (native balance change is in lamports, can be positive for receiving)
          const balanceChange = accountChange.nativeBalanceChange;
          if (balanceChange > 0) {
            solAmount = balanceChange / 1e9;
          }
        }
        
        // Also check tokenBalanceChanges
        if (accountChange.tokenBalanceChanges) {
          for (const balanceChange of accountChange.tokenBalanceChanges) {
            if (balanceChange.mint === tokenMint && balanceChange.rawTokenAmount) {
              // Positive change means user received tokens
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
      timestamp,
      blockTime: timestamp,
      displayToken: 'SOL',
      dex: 'Meteora',
      claimFeesAmount: claimFeesAmount > 0 ? claimFeesAmount : undefined,
    };
  }

  static parseTransfer(
    heliusTx: HeliusTransaction,
    tokenMint: string
  ): Transaction | null {
    const { signature, timestamp, tokenTransfers, feePayer } = heliusTx;
    
    const tokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint);
    if (!tokenTransfer) return null;
    
    return {
      id: signature,
      signature,
      type: 'TRANSFER',
      wallet: tokenTransfer.fromUserAccount || feePayer || '',
      tokenAmount: tokenTransfer.tokenAmount || 0,
      solAmount: 0,
      timestamp,
      blockTime: timestamp,
      displayToken: 'Transfer',
      dex: undefined,
    };
  }

  static parse(heliusTx: HeliusTransaction, tokenMint: string): Transaction | null {
    try {
      const { signature, timestamp, tokenTransfers, nativeTransfers, accountData, type, feePayer, source, instructions } = heliusTx;

      // Check if this is a simple wallet-to-wallet transfer
      const isSimpleTransfer = type === 'TRANSFER' && source === 'SOLANA_PROGRAM_LIBRARY';

      // Check if this is a Meteora DLMM transaction first
      const METEORA_DLMM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
      const meteoraInstructions = instructions?.filter((ix: any) => 
        ix.programId === METEORA_DLMM
      );

      // If this is a Meteora transaction, check what type it is
      if (meteoraInstructions && meteoraInstructions.length > 0) {
        // Check for specific instruction discriminators
        const DISCRIMINATORS = {
          ADD_LIQUIDITY: '4Co7us6MBHJN',
          REMOVE_LIQUIDITY: '7FKxUv3oxZYZ',
          // SWAP: 'fx9RHbGFfZ8h' // We let swaps fall through to standard BUY/SELL logic
        };

        for (const ix of meteoraInstructions) {
          if (ix.data) {
            if (ix.data.startsWith(DISCRIMINATORS.ADD_LIQUIDITY)) {
              return this.parseAddLiquidity(heliusTx, tokenMint, feePayer);
            }
            if (ix.data.startsWith(DISCRIMINATORS.REMOVE_LIQUIDITY)) {
              return this.parseRemoveLiquidity(heliusTx, tokenMint, null, feePayer);
            }
          }
        }

        const WSOL_MINT = 'So11111111111111111111111111111111111111112';
        
        // 1. Analyze Flow: Calculate Net Flow for Token and SOL
        let netTokenAmount = 0;
        let netSolAmount = 0;

        // Check Token Transfers
        tokenTransfers?.forEach(t => {
          if (t.mint === tokenMint) {
            if (t.fromUserAccount === feePayer) netTokenAmount -= t.tokenAmount;
            if (t.toUserAccount === feePayer) netTokenAmount += t.tokenAmount;
          } else if (t.mint === WSOL_MINT) {
            if (t.fromUserAccount === feePayer) netSolAmount -= t.tokenAmount;
            if (t.toUserAccount === feePayer) netSolAmount += t.tokenAmount;
          }
        });

        // Check Native Transfers
        nativeTransfers?.forEach(t => {
          if (t.fromUserAccount === feePayer) netSolAmount -= t.amount / 1e9;
          if (t.toUserAccount === feePayer) netSolAmount += t.amount / 1e9;
        });

        // 2. Determine Type based on Net Flow
        // Positive = User Received
        // Negative = User Sent

        const isTokenPositive = netTokenAmount > 0;
        const isTokenNegative = netTokenAmount < 0;
        const isSolPositive = netSolAmount > 0;
        const isSolNegative = netSolAmount < 0;

        // REMOVE LIQUIDITY or CLAIM FEES: User receives assets (Token and/or SOL)
        // Condition: Net Token >= 0 AND Net SOL >= 0 (and at least one is positive)
        // We use a small epsilon for float comparison to avoid dust issues, but generally 0 is fine.
        if ((netTokenAmount >= 0 && netSolAmount >= 0) && (netTokenAmount > 0 || netSolAmount > 0)) {
           // Distinguish Claim Fees vs Remove Liquidity
           // Use existing logic inside parseRemoveLiquidity/parseClaimFees to refine
           
           // Check strict Claim Fees pattern first (exactly 2 transfers)
           const transfersToUser = tokenTransfers?.filter(t => t.toUserAccount === feePayer) || [];
           const ourTokenTransfer = tokenTransfers?.find(t => t.mint === tokenMint);
           const wsolTransfers = tokenTransfers?.filter(t => t.mint === WSOL_MINT) || [];
           
           const isStrictClaimFees = transfersToUser.length === 2 && 
            ourTokenTransfer && wsolTransfers.length === 1 &&
            ourTokenTransfer.toUserAccount === feePayer &&
            wsolTransfers[0].toUserAccount === feePayer;

           if (isStrictClaimFees) {
             return this.parseClaimFees(heliusTx, tokenMint, feePayer);
           }
           
           return this.parseRemoveLiquidity(heliusTx, tokenMint, null, feePayer);
        }
        
        // ADD LIQUIDITY: User sends assets (Token and/or SOL)
        // Condition: Net Token <= 0 AND Net SOL <= 0 (and at least one is negative)
        else if ((netTokenAmount <= 0 && netSolAmount <= 0) && (netTokenAmount < 0 || netSolAmount < 0)) {
          return this.parseAddLiquidity(heliusTx, tokenMint, feePayer);
        }

        // SWAP: Mixed signs (User sends one, receives other)
        // Fall through to standard BUY/SELL logic
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

      // Check if this is a Remove Liquidity transaction (legacy check for standard transfers)
      // Removed accounts.length check as it was misclassifying Swaps
      const isRemoveLiquidity = instructions?.some((ix: any) => 
        ix.programId === METEORA_DLMM && 
        ix.data?.includes('remove_liquidity')
      );

      if (isRemoveLiquidity) {
        return this.parseRemoveLiquidity(heliusTx, tokenMint, tokenTransfer, feePayer);
      }

      // Simple swap direction logic:
      // BUY = any token X → our token (someone receives our token)
      // SELL = our token → any token X (someone sends our token)
      
      let toAccount = tokenTransfer.toUserAccount;
      let fromAccount = tokenTransfer.fromUserAccount;
      
      // Handle empty toUserAccount or fromUserAccount
      // If toUserAccount is empty, this is likely a SELL (feePayer is selling)
      // If fromUserAccount is empty, this is likely a BUY (feePayer is buying)
      if (!toAccount || toAccount === '') {
        toAccount = feePayer || '';
      }
      if (!fromAccount || fromAccount === '') {
        fromAccount = feePayer || '';
      }
      
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
      
      // Check for WSOL, USDC, USDT in token transfers
      const WSOL_MINT = 'So11111111111111111111111111111111111111112';
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

      // Collect all quote amounts from different tokens
      let usdcAmount = 0;
      let usdtAmount = 0;
      let wsolAmount = 0;

      if (tokenTransfers && tokenTransfers.length > 0) {
        // First pass: look for transfers directly involving the user's wallet
        for (const transfer of tokenTransfers) {
          // Skip the main token transfer
          if (transfer.mint === tokenMint) continue;

          // Check if this transfer involves the user
          const isRelevant = 
            (isBuy && transfer.fromUserAccount === actualWallet) || // User paying with Quote
            (!isBuy && transfer.toUserAccount === actualWallet);    // User receiving Quote

          if (isRelevant) {
            if (transfer.mint === USDC_MINT) {
              usdcAmount += transfer.tokenAmount;
            } else if (transfer.mint === USDT_MINT) {
              usdtAmount += transfer.tokenAmount;
            } else if (transfer.mint === WSOL_MINT) {
              wsolAmount += transfer.tokenAmount;
            }
          }
        }
        
        // Second pass: ALWAYS check for WSOL in the entire transaction
        // This ensures we catch WSOL even if USDC was found in first pass
        // (handles Jupiter routing: user pays USDC -> intermediate WSOL -> target token)
        if (wsolAmount === 0) {
          let maxWsol = 0;
          
          for (const transfer of tokenTransfers) {
            if (transfer.mint === tokenMint) continue;
            
            if (transfer.mint === WSOL_MINT) {
              maxWsol = Math.max(maxWsol, transfer.tokenAmount);
            }
          }
          
          if (maxWsol > 0) {
            wsolAmount = maxWsol;
          }
        }
        
        // Third pass: if still no amounts found, look for any USDC/USDT
        if (usdcAmount === 0 && usdtAmount === 0 && wsolAmount === 0) {
          let maxUsdc = 0;
          let maxUsdt = 0;
          
          for (const transfer of tokenTransfers) {
            if (transfer.mint === tokenMint) continue;
            
            if (transfer.mint === USDC_MINT) {
              maxUsdc = Math.max(maxUsdc, transfer.tokenAmount);
            } else if (transfer.mint === USDT_MINT) {
              maxUsdt = Math.max(maxUsdt, transfer.tokenAmount);
            }
          }
          
          usdcAmount = maxUsdc;
          usdtAmount = maxUsdt;
        }
      }

      // Prioritize WSOL/SOL over stablecoins - SOL is the primary trading pair on Solana
      // USDC/USDT shown only when there's absolutely no SOL/WSOL in the transaction
      if (wsolAmount > 0) {
        // Use WSOL as primary display (standardized in SOL)
        solAmount = wsolAmount;
        displayToken = 'SOL';
      } else if (usdcAmount > 0) {
        // If only USDC found (no WSOL routing), display USDC
        solAmount = usdcAmount;
        displayToken = 'USDC';
      } else if (usdtAmount > 0) {
        // If only USDT found (no WSOL routing), display USDT
        solAmount = usdtAmount;
        displayToken = 'USDT';
      }

      // If no quote token found in token transfers, check native SOL
      if (solAmount === 0 && nativeTransfers && nativeTransfers.length > 0) {
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
          solAmount = relevantTransfer.amount / 1e9;
        } else {
          // Fallback: find any SOL transfer related to this wallet
          const anyTransfer = nativeTransfers.find(
            (transfer) =>
              transfer.fromUserAccount === actualWallet || transfer.toUserAccount === actualWallet
          );
          if (anyTransfer) {
            solAmount = anyTransfer.amount / 1e9;
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
          'boop8hVGQGQGqehUK2iVEMEnMrL5RbjywRzHKBmBE7ry4': 'BOOP.FUN',
          '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'PUMP.FUN',
          'MoonCVVNZFSYkqN5438hi3fulh6Nj59sbpxmaxhY9Q': 'MOONSHOT',
          'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA': 'PUMP_FUN_AMM',
          'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'METEORA DLMM',
          'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG': 'METEORA_DAMM_V2',
        };

        for (const acc of accountData) {
          if (programMap[acc.account]) {
            dex = programMap[acc.account];
            break;
          }
        }
      }

      // Special handling for non-swap transactions (claim fees, etc.)
      // If no SOL/USDC/USDT found and transaction is claim-related, mark as such
      if (solAmount === 0 && (type === 'CLAIM_POSITION_FEE' || type?.includes('CLAIM'))) {
        displayToken = 'Fees';
      }

      // If this is a simple transfer, parse it as TRANSFER type
      if (isSimpleTransfer) {
        return this.parseTransfer(heliusTx, tokenMint);
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
