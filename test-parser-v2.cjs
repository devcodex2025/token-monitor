const fs = require('fs');

// Load the transaction
const transaction = JSON.parse(fs.readFileSync('helius-tx-5iyJkcQy.json', 'utf8'));

const tokenMint = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump';
const { signature, timestamp, tokenTransfers, nativeTransfers, accountData, type, feePayer, source } = transaction;

console.log('=== Testing Updated Parser Logic ===\n');

// Find token transfer for our mint
const tokenTransfer = tokenTransfers.find(
  (transfer) => transfer.mint === tokenMint
);

// Determine direction
const toAccount = tokenTransfer.toUserAccount;
const fromAccount = tokenTransfer.fromUserAccount;
let isBuy = feePayer === toAccount;
let actualWallet = isBuy ? toAccount : fromAccount;

console.log('Direction:', isBuy ? 'BUY' : 'SELL');
console.log('Wallet:', actualWallet);

// Collect amounts
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

let usdcAmount = 0;
let usdtAmount = 0;
let wsolAmount = 0;

console.log('\n=== Collecting Quote Amounts (user-related transfers) ===');
for (const transfer of tokenTransfers) {
  if (transfer.mint === tokenMint) continue;

  const isRelevant = 
    (isBuy && transfer.fromUserAccount === actualWallet) || 
    (!isBuy && transfer.toUserAccount === actualWallet);

  if (isRelevant) {
    if (transfer.mint === USDC_MINT) {
      console.log('+ USDC:', transfer.tokenAmount);
      usdcAmount += transfer.tokenAmount;
    } else if (transfer.mint === USDT_MINT) {
      console.log('+ USDT:', transfer.tokenAmount);
      usdtAmount += transfer.tokenAmount;
    } else if (transfer.mint === WSOL_MINT) {
      console.log('+ WSOL:', transfer.tokenAmount);
      wsolAmount += transfer.tokenAmount;
    }
  }
}

console.log('\nTotals from user-related transfers:');
console.log('  USDC:', usdcAmount);
console.log('  USDT:', usdtAmount);
console.log('  WSOL:', wsolAmount);

// If nothing found, look for any transfers
if (usdcAmount === 0 && usdtAmount === 0 && wsolAmount === 0) {
  console.log('\n=== No user-related transfers, checking all transfers ===');
  for (const transfer of tokenTransfers) {
    if (transfer.mint === tokenMint) continue;
    
    if (transfer.mint === WSOL_MINT) {
      console.log('+ WSOL:', transfer.tokenAmount);
      wsolAmount += transfer.tokenAmount;
    } else if (transfer.mint === USDC_MINT) {
      console.log('+ USDC:', transfer.tokenAmount);
      usdcAmount += transfer.tokenAmount;
    } else if (transfer.mint === USDT_MINT) {
      console.log('+ USDT:', transfer.tokenAmount);
      usdtAmount += transfer.tokenAmount;
    }
  }
  
  console.log('\nTotals from all transfers:');
  console.log('  USDC:', usdcAmount);
  console.log('  USDT:', usdtAmount);
  console.log('  WSOL:', wsolAmount);
}

// Select priority: WSOL > USDC > USDT (standardize to SOL)
let solAmount = 0;
let displayToken = 'SOL';

if (wsolAmount > 0) {
  solAmount = wsolAmount;
  displayToken = 'SOL';
} else if (usdcAmount > 0) {
  solAmount = usdcAmount;
  displayToken = 'USDC';
} else if (usdtAmount > 0) {
  solAmount = usdtAmount;
  displayToken = 'USDT';
}

console.log('\n=== Final Result ===');
console.log('Amount:', solAmount);
console.log('Token:', displayToken);
console.log('\n✓ Expected: 4.766 SOL (standardized, not 579.825 USDC)');
console.log('✓ Match:', Math.abs(solAmount - 4.766258481) < 0.001 ? 'YES' : 'NO');
