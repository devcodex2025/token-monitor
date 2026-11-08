const fs = require('fs');
const path = require('path');

const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-remove-liq-real.json')));
const tx = json[0];

console.log('\n=== Remove Liquidity Transaction Analysis ===');
console.log('Type:', tx.type);
console.log('Source:', tx.source);
console.log('Signature:', tx.signature.slice(0, 20) + '...');
console.log('Fee Payer:', tx.feePayer);

console.log('\nToken Transfers:');
tx.tokenTransfers?.forEach(t => {
  console.log(`  From: ${t.fromUserAccount.slice(0, 8)}... -> To: ${t.toUserAccount.slice(0, 8)}...`);
  console.log(`  Mint: ${t.mint.slice(0, 8)}...`);
  console.log(`  Amount: ${t.tokenAmount}`);
  console.log(`  To User is FeePayer: ${t.toUserAccount === tx.feePayer}`);
  console.log('');
});

console.log('Instructions:');
tx.instructions?.forEach((ix, i) => {
  console.log(`  ${i}. ${ix.programId}`);
  if (ix.programId === 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo') {
    console.log(`     Meteora DLMM - InnerInstructions: ${ix.innerInstructions?.length || 0}`);
    if (ix.accounts) {
      const hasOurToken = ix.accounts.includes('CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump');
      console.log(`     Has our token: ${hasOurToken}`);
    }
  }
});

console.log('\nExpected Result:');
console.log('  Type: REMOVE_LIQUIDITY');
console.log('  Should show actual SOL and token amounts');
console.log('  DEX: Meteora (with logo)');

console.log('\n');
