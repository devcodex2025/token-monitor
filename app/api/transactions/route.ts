import { NextRequest, NextResponse } from 'next/server';
import { HeliusService } from '@/lib/helius';
import { TransactionParser } from '@/lib/transactionParser';

export async function POST(request: NextRequest) {
  try {
    const { tokenAddress, before } = await request.json();

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Helius API key not configured' },
        { status: 500 }
      );
    }

    const helius = new HeliusService(apiKey);
    
    // Fetch transaction history
    const heliusTxs = await helius.getTransactionHistory(tokenAddress, { 
      before, 
      limit: 100 
    });
    
    // Parse transactions
    const transactions = TransactionParser.parseMultiple(heliusTxs, tokenAddress);

    return NextResponse.json({
      success: true,
      transactions: transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
