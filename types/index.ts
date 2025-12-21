export interface Transaction {
  id: string;
  signature: string;
  type: 'BUY' | 'SELL' | 'REMOVE_LIQUIDITY' | 'CLAIM_FEES';
  wallet: string;
  tokenAmount: number;
  solAmount: number;
  timestamp: number;
  blockTime: number;
  displayToken?: string;
  dex?: string;
}

export interface TokenMonitorConfig {
  tokenAddress: string;
  mode: 'live' | 'all';
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
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
    }>;
  }>;
}
