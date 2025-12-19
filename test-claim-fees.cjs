const fs = require('fs');

// Load the transaction
const transaction = JSON.parse(fs.readFileSync('helius-tx-XYLDGTfH.json', 'utf8'));

const tokenMint = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump';
const { signature, timestamp, tokenTransfers, nativeTransfers, accountData, type, feePayer, source } = transaction;

console.log('=== Testing CLAIM_POSITION_FEE Transaction ===\n');
console.log('Type:', type);
console.log('Source:', source);
console.log('Token Mint:', tokenMint);

// Find token transfer for our mint
const tokenTransfer = tokenTransfers.find(
  (transfer) => transfer.mint === tokenMint
);

if (!tokenTransfer) {
  console.log('\n❌ Token not found in transaction');
  process.exit(0);
}

console.log('\n=== Token Transfer ===');
console.log('From:', tokenTransfer.fromUserAccount);
console.log('To:', tokenTransfer.toUserAccount);
console.log('Amount:', tokenTransfer.tokenAmount);

// Determine direction
const toAccount = tokenTransfer.toUserAccount;
const fromAccount = tokenTransfer.fromUserAccount;
let isBuy = feePayer === toAccount;
let actualWallet = isBuy ? toAccount : fromAccount;

console.log('\nDirection:', isBuy ? 'BUY' : 'SELL');
console.log('Wallet:', actualWallet);

// Check for SOL/WSOL
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

let wsolAmount = 0;
let usdcAmount = 0;

console.log('\n=== Looking for Quote Amounts ===');
for (const transfer of tokenTransfers) {
  if (transfer.mint === tokenMint) continue;

  const isRelevant = 
    (isBuy && transfer.fromUserAccount === actualWallet) || 
    (!isBuy && transfer.toUserAccount === actualWallet);

  if (isRelevant) {
    if (transfer.mint === WSOL_MINT) {
      console.log('Found WSOL:', transfer.tokenAmount);
      wsolAmount += transfer.tokenAmount;
    } else if (transfer.mint === USDC_MINT) {
      console.log('Found USDC:', transfer.tokenAmount);
      usdcAmount += transfer.tokenAmount;
    }
  }
}

console.log('\nTotal WSOL:', wsolAmount);
console.log('Total USDC:', usdcAmount);

// Determine display
let solAmount = 0;
let displayToken = 'SOL';

if (wsolAmount > 0) {
  solAmount = wsolAmount;
  displayToken = 'SOL';
} else if (usdcAmount > 0) {
  solAmount = usdcAmount;
  displayToken = 'USDC';
}

// Special handling for claim fees
if (solAmount === 0 && (type === 'CLAIM_POSITION_FEE' || type?.includes('CLAIM'))) {
  displayToken = 'Fees';
}

console.log('\n=== Final Result ===');
console.log('SOL Amount:', solAmount);
console.log('Display Token:', displayToken);
console.log('UI Display:', displayToken === 'Fees' ? '(Claim Fees)' : `${solAmount} ${displayToken}`);
console.log('\n✓ Expected: Display "(Claim Fees)" instead of SOL amount');
