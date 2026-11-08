/**
 * Helius Webhooks Setup Guide
 * 
 * Цей файл містить інструкції та код для налаштування Helius webhooks
 * для отримання транзакцій в реальному часі без polling.
 */

import { HeliusService } from './helius';

export class HeliusWebhookManager {
  private helius: HeliusService;
  private webhookUrl: string;

  constructor(apiKey: string, webhookUrl: string) {
    this.helius = new HeliusService(apiKey);
    this.webhookUrl = webhookUrl;
  }

  /**
   * Створює новий webhook для моніторингу токена
   */
  async createWebhook(tokenAddress: string, webhookId?: string) {
    const url = `https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`;
    
    const payload = {
      webhookURL: this.webhookUrl,
      transactionTypes: ['SWAP', 'TRANSFER'],
      accountAddresses: [tokenAddress],
      webhookType: 'enhanced',
      txnStatus: 'all', // або 'success' для підтверджених
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to create webhook: ${await response.text()}`);
      }

      const data = await response.json();
      console.log('✅ Webhook created:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to create webhook:', error);
      throw error;
    }
  }

  /**
   * Отримує список всіх webhooks
   */
  async listWebhooks() {
    const url = `https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to list webhooks: ${await response.text()}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to list webhooks:', error);
      throw error;
    }
  }

  /**
   * Оновлює існуючий webhook (додає новий токен)
   */
  async updateWebhook(webhookId: string, tokenAddresses: string[]) {
    const url = `https://api.helius.xyz/v0/webhooks/${webhookId}?api-key=${process.env.HELIUS_API_KEY}`;
    
    const payload = {
      accountAddresses: tokenAddresses,
    };

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to update webhook: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to update webhook:', error);
      throw error;
    }
  }

  /**
   * Видаляє webhook
   */
  async deleteWebhook(webhookId: string) {
    const url = `https://api.helius.xyz/v0/webhooks/${webhookId}?api-key=${process.env.HELIUS_API_KEY}`;
    
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to delete webhook: ${await response.text()}`);
      }
      console.log('✅ Webhook deleted');
      return true;
    } catch (error) {
      console.error('❌ Failed to delete webhook:', error);
      throw error;
    }
  }
}

// CLI helper для швидкого налаштування
if (require.main === module) {
  const manager = new HeliusWebhookManager(
    process.env.HELIUS_API_KEY || '',
    process.env.WEBHOOK_URL || 'https://your-domain.vercel.app/api/webhook'
  );

  const command = process.argv[2];
  const arg = process.argv[3];

  (async () => {
    switch (command) {
      case 'create':
        if (!arg) {
          console.error('❌ Потрібна адреса токена: npm run webhook create <TOKEN_ADDRESS>');
          process.exit(1);
        }
        await manager.createWebhook(arg);
        break;

      case 'list':
        const webhooks = await manager.listWebhooks();
        console.log('📋 Webhooks:', JSON.stringify(webhooks, null, 2));
        break;

      case 'delete':
        if (!arg) {
          console.error('❌ Потрібен ID webhook: npm run webhook delete <WEBHOOK_ID>');
          process.exit(1);
        }
        await manager.deleteWebhook(arg);
        break;

      default:
        console.log(`
Використання:
  npm run webhook create <TOKEN_ADDRESS>  - створити webhook для токена
  npm run webhook list                    - показати всі webhooks
  npm run webhook delete <WEBHOOK_ID>     - видалити webhook

Приклад:
  npm run webhook create So11111111111111111111111111111111111111112
        `);
    }
  })();
}
