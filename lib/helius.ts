import axios from 'axios';
import { HeliusTransaction } from '@/types';

export class HeliusService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getTransactionHistory(
    tokenAddress: string,
    beforeSignature?: string,
    limit: number = 100
  ): Promise<HeliusTransaction[]> {
    try {
      let url = `https://api-mainnet.helius-rpc.com/v0/addresses/${tokenAddress}/transactions?api-key=${this.apiKey}&limit=${limit}`;
      
      if (beforeSignature) {
        url += `&before=${beforeSignature}`;
      }

      const response = await axios.get(url);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }

  async getEnhancedTransaction(signature: string): Promise<HeliusTransaction | null> {
    try {
      const response = await axios.post(
        `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${this.apiKey}`,
        {
          transactions: [signature],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching enhanced transaction:', error);
      return null;
    }
  }

  async parseWebhookData(data: any): Promise<HeliusTransaction[]> {
    // Parse webhook data from Helius
    return Array.isArray(data) ? data : [data];
  }
}
