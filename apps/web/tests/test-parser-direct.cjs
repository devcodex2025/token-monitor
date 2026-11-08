const fs = require('fs');
const path = require('path');

// Import compiled TypeScript
const { TransactionParser } = require('../.next/server/app/api/stream/route.js');

// Read test transaction
const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-remove-liq.json'), 'utf8'));
const tx = json[0];

const tokenMint = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump';

console.log('\n=== Testing Transaction Parser ===\n');
console.log('Input:');
console.log('  Signature:', tx.signature.slice(0, 20) + '...');
console.log('  Type:', tx.type);
console.log('  Fee Payer:', tx.feePayer);
console.log('  Token Transfers:', tx.tokenTransfers?.length || 0);
console.log('  Instructions:', tx.instructions?.length || 0);

// Find Meteora instructions
const meteoraInstructions = tx.instructions?.filter(ix => 
  ix.programId === 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
);
console.log('  Meteora DLMM instructions:', meteoraInstructions?.length || 0);

// Check if our token is in any innerInstructions
let foundOurToken = false;
for (const ix of meteoraInstructions || []) {
  if (ix.innerInstructions) {
    for (const inner of ix.innerInstructions) {
      if (inner.accounts && inner.accounts.includes(tokenMint)) {
        foundOurToken = true;
        break;
      }
    }
  }
}
console.log('  Our token in innerInstructions:', foundOurToken);

try {
  const result = TransactionParser.parse(tx, tokenMint);
  console.log('\nParsed Result:');
  if (result) {
    console.log('  ✅ Successfully parsed!');
    console.log('  Type:', result.type);
    console.log('  Wallet:', result.wallet);
    console.log('  Token Amount:', result.tokenAmount);
    console.log('  SOL Amount:', result.solAmount);
    console.log('  DEX:', result.dex);
  } else {
    console.log('  ❌ Parser returned NULL');
  }
} catch (error) {
  console.log('  ❌ Error:', error.message);
  console.log(error.stack);
}

console.log('\n');
