import axios from 'axios';
import { HeliusTransaction } from '../types';

export class HeliusService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getTransactionHistory(
    tokenAddress: string,
    options: { before?: string; until?: string; limit?: number } = {}
  ): Promise<HeliusTransaction[]> {
    const result = await this.getTransactionHistoryWithMeta(tokenAddress, options);
    return result.data;
  }

  async getTransactionHistoryWithMeta(
    tokenAddress: string,
    options: { before?: string; until?: string; limit?: number } = {}
  ): Promise<{ data: HeliusTransaction[]; headers: Record<string, unknown>; status: number }> {
    try {
      const limit = options.limit || 100;
      let url = `https://api.helius.xyz/v0/addresses/${tokenAddress}/transactions?api-key=${this.apiKey}&limit=${limit}&commitment=confirmed`;
      
      if (options.before) {
        url += `&before=${options.before}`;
      }
      
      if (options.until) {
        url += `&until=${options.until}`;
      }

      const response = await axios.get(url);
      return {
        data: response.data || [],
        headers: response.headers || {},
        status: response.status,
      };
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }

  async getEnhancedTransaction(signature: string): Promise<HeliusTransaction | null> {
    try {
      const response = await axios.post(
        `https://api.helius.xyz/v0/transactions/?api-key=${this.apiKey}`,
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

  // Alias for getEnhancedTransaction
  async getTransactionBySignature(signature: string): Promise<HeliusTransaction | null> {
    return this.getEnhancedTransaction(signature);
  }

  async parseWebhookData(data: any): Promise<HeliusTransaction[]> {
    // Parse webhook data from Helius
    return Array.isArray(data) ? data : [data];
  }
}
