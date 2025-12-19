const fs = require('fs');

// Load the transaction
const transaction = JSON.parse(fs.readFileSync('helius-tx-5iyJkcQy.json', 'utf8'));

const tokenMint = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump';
const { signature, timestamp, tokenTransfers, nativeTransfers, accountData, type, feePayer, source } = transaction;

console.log('=== Simulating Transaction Parser ===\n');
console.log('Token Mint:', tokenMint);
console.log('Fee Payer:', feePayer);
console.log('Source:', source);

// Find token transfer for our mint
const tokenTransfer = tokenTransfers.find(
  (transfer) => transfer.mint === tokenMint
);

console.log('\n=== Main Token Transfer ===');
console.log('From:', tokenTransfer.fromUserAccount);
console.log('To:', tokenTransfer.toUserAccount);
console.log('Amount:', tokenTransfer.tokenAmount);

// Determine direction
const toAccount = tokenTransfer.toUserAccount;
const fromAccount = tokenTransfer.fromUserAccount;
let isBuy = false;
let actualWallet = '';

if (feePayer === toAccount) {
  isBuy = true;
  actualWallet = toAccount;
  console.log('\nDirection: BUY (feePayer receives token)');
} else if (feePayer === fromAccount) {
  isBuy = false;
  actualWallet = fromAccount;
  console.log('\nDirection: SELL (feePayer sends token)');
}

console.log('Actual Wallet:', actualWallet);

// Find associated SOL or other token transfer
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

console.log('\n=== Looking for Quote Amount ===');

// Priority 1: WSOL transfers involving user
console.log('\n1. Looking for WSOL transfers involving user wallet...');
for (const transfer of tokenTransfers) {
  if (transfer.mint === tokenMint) continue;
  
  const isRelevant = 
    (isBuy && transfer.fromUserAccount === actualWallet) || 
    (!isBuy && transfer.toUserAccount === actualWallet);

  if (isRelevant && transfer.mint === WSOL_MINT) {
    console.log('  ✓ Found WSOL:', transfer.tokenAmount, 'SOL');
    console.log('    From:', transfer.fromUserAccount);
    console.log('    To:', transfer.toUserAccount);
  }
}

// Priority 2: Any WSOL transfer
console.log('\n2. Looking for any WSOL transfers...');
for (const transfer of tokenTransfers) {
  if (transfer.mint === WSOL_MINT && transfer.mint !== tokenMint) {
    console.log('  Found WSOL:', transfer.tokenAmount, 'SOL');
    console.log('    From:', transfer.fromUserAccount);
    console.log('    To:', transfer.toUserAccount);
  }
}

// Priority 3: USDC/USDT
console.log('\n3. Looking for USDC/USDT transfers involving user wallet...');
for (const transfer of tokenTransfers) {
  if (transfer.mint === tokenMint) continue;

  const isRelevant = 
    (isBuy && transfer.fromUserAccount === actualWallet) || 
    (!isBuy && transfer.toUserAccount === actualWallet);

  if (isRelevant) {
    if (transfer.mint === USDC_MINT) {
      console.log('  ✓ Found USDC:', transfer.tokenAmount, 'USDC');
      console.log('    From:', transfer.fromUserAccount);
      console.log('    To:', transfer.toUserAccount);
    } else if (transfer.mint === USDT_MINT) {
      console.log('  ✓ Found USDT:', transfer.tokenAmount, 'USDT');
      console.log('    From:', transfer.fromUserAccount);
      console.log('    To:', transfer.toUserAccount);
    }
  }
}

// Priority 4: Native SOL
console.log('\n4. Looking for native SOL transfers...');
if (nativeTransfers && nativeTransfers.length > 0) {
  for (const transfer of nativeTransfers) {
    const isRelevant = 
      (isBuy && transfer.fromUserAccount === actualWallet) ||
      (!isBuy && transfer.toUserAccount === actualWallet);
      
    if (isRelevant) {
      console.log('  Found native SOL:', transfer.amount / 1e9, 'SOL');
      console.log('    From:', transfer.fromUserAccount);
      console.log('    To:', transfer.toUserAccount);
    }
  }
}

console.log('\n=== Expected Result ===');
console.log('Should display: 579.825 USDC as the quote amount');
