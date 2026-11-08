export interface Transaction {
  id: string;
  signature: string;
  type: 'BUY' | 'SELL' | 'REMOVE_LIQUIDITY' | 'CLAIM_FEES' | 'ADD_LIQUIDITY' | 'TRANSFER' | 'CREATE_POOL';
  wallet: string;
  tokenAmount: number;
  solAmount: number;
  timestamp: number;
  blockTime: number;
  displayToken?: string;
  dex?: string;
  claimFeesAmount?: number; // For combined Remove Liquidity + Claim Fees
  walletBalance?: number; // Wallet SOL balance
}

export interface TokenMonitorConfig {
  tokenAddress: string;
  mode: 'live' | 'all';
  heliusApiKey?: string;
}

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
  resetMs?: number;
  retryAfter?: number;
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  slot?: number;
  type: string;
  source?: string;
  feePayer: string;
  fee?: number;
  transactionError?: any;
  instructions?: Array<any>;
  events?: any;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount?: string;
    toTokenAccount?: string;
    tokenAmount: number;
    mint: string;
    tokenStandard?: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  accountData?: Array<{
    account: string;
    nativeBalanceChange?: number;
    tokenBalanceChanges?: Array<{
      userAccount?: string;
      tokenAccount?: string;
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
    }>;
  }>;
  accountBalances?: Record<string, number>; // Map of account address to SOL balance
}
