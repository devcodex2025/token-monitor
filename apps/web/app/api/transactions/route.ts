import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';
import { HeliusService } from '@/lib/helius';
import { TransactionParser } from '@/lib/transactionParser';
import { getHeliusApiKeyFromRequest } from '@/lib/heliusKey';
import { extractRateLimit } from '@/lib/heliusRateLimit';

export async function POST(request: NextRequest) {
  try {
    const { tokenAddress, before } = await request.json();

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    const apiKey = getHeliusApiKeyFromRequest(request) || process.env.HELIUS_API_KEY;
    if (!apiKey) {
      const usingUserKey = Boolean(getHeliusApiKeyFromRequest(request));
      const message = usingUserKey 
        ? 'Helius API key not configured' 
        : 'Server rate limit exceeded. Please provide your own Helius API key to continue.';
      return NextResponse.json(
        { error: message, needsApiKey: !usingUserKey },
        { status: 500 }
      );
    }

    const helius = new HeliusService(apiKey);
    
    const validTransactions = [];
    let currentBefore = before;
    let rawCount = 0;
    let hasMore = true;
    let attempts = 0;
    let rateLimitInfo: ReturnType<typeof extractRateLimit> = null;
    const MAX_ATTEMPTS = 10; // Optimized: Reduced from 15 to 10 to improve response time while still scanning 1000 txs
    
    // Loop to fetch until we have enough valid transactions or run out of history
    while (validTransactions.length < 100 && attempts < MAX_ATTEMPTS && hasMore) {
        attempts++;
        console.log(`Fetching batch ${attempts}, before: ${currentBefore || 'latest'}`);
        
        const heliusResponse = await helius.getTransactionHistoryWithMeta(tokenAddress, { 
            before: currentBefore, 
            limit: 100 
        });
        const heliusTxs = heliusResponse.data;
        const batchRateLimit = extractRateLimit(heliusResponse.headers || {});
        if (batchRateLimit) {
          rateLimitInfo = batchRateLimit;
        }
        
        rawCount += heliusTxs.length;
        console.log(`Batch ${attempts}: Helius returned ${heliusTxs.length} raw transactions`);

        if (heliusTxs.length < 100) {
            hasMore = false;
        }
        
        if (heliusTxs.length > 0) {
            // Update cursor for next iteration
            currentBefore = heliusTxs[heliusTxs.length - 1].signature;
            
            // Parse transactions
            const { parsedTxs, skipReasons: batchSkipReasons } = TransactionParser.parseMultiple(heliusTxs, tokenAddress);
            console.log(`Batch ${attempts}: Parsed ${parsedTxs.length} valid transactions`);
            validTransactions.push(...parsedTxs);
        } else {
            hasMore = false;
        }
    }

    let lastSignature = currentBefore;

    // Ensure we strictly return 100 transactions if we have at least 100
    // This provides a clean "page" experience for the user.
    if (validTransactions.length >= 100) {
       // If we have more than 100, trim the excess
       if (validTransactions.length > 100) {
          console.log(`Trimming ${validTransactions.length} transactions to 100`);
          validTransactions.length = 100;
       }
       
       // CRITICAL: Update lastSignature to correspond to the LAST item in our trimmed list.
       // This ensures the next "loadMore" starts exactly after this transaction.
       // Note: Helius 'before' parameter excludes the target signature, effectively giving us the next ones.
       // We accept that any skipped/spam transactions that occurred *between* the 100th valid tx 
       // and the previous scan boundary (currentBefore) will be re-scanned next time. 
       // This re-scanning is necessary to maintain strict pagination counts.
       lastSignature = validTransactions[99].signature;
       
       // Since we are forcing a cut, there is definitely "more" (or at least we should try)
       hasMore = true;
    } else {
        // If we have fewer than 100, use the scan boundary as the cursor
        lastSignature = currentBefore;
    }

    return NextResponse.json({
      success: true,
      transactions: validTransactions,
      count: validTransactions.length,
      rawCount: rawCount,
      hasMore: hasMore,
      lastSignature: lastSignature,
      rateLimit: rateLimitInfo
    });
  } catch (error) {
    console.error('API error:', error);
    if (axios.isAxiosError(error) && error.response) {
      const rateLimit = extractRateLimit(error.response.headers || {});
      const status = error.response.status || 500;
      const usingUserKey = Boolean(getHeliusApiKeyFromRequest(request));
      
      let message = 'Helius API request failed';
      if (status === 429) {
        message = usingUserKey 
          ? 'Your Helius API rate limit exceeded. Please try again later.'
          : 'Server rate limit exceeded. Please provide your own Helius API key to continue.';
      } else if (status === 403) {
        message = usingUserKey
          ? 'Your Helius API key is not authorized'
          : 'Server API key issue. Please provide your own Helius API key to continue.';
      }
      
      return NextResponse.json(
        { error: message, rateLimit, needsApiKey: !usingUserKey && (status === 429 || status === 403) },
        { status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
