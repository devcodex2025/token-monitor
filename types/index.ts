export interface Transaction {
  id: string;
  signature: string;
  type: 'BUY' | 'SELL';
  wallet: string;
  tokenAmount: number;
  solAmount: number;
  timestamp: number;
  blockTime: number;
  displayToken?: string;
}

export interface TokenMonitorConfig {
  tokenAddress: string;
  mode: 'live' | 'all';
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  accountData?: Array<{
    account: string;
    tokenBalanceChanges?: Array<{
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
    }>;
  }>;
}
