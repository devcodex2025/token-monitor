const fs = require('fs');

// Read test claim fees transaction
const json = JSON.parse(fs.readFileSync('test-claim-fees-tx.json', 'utf8'));
const tx = json[0];

console.log('\n=== Claim Fees Transaction Analysis ===');
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

console.log('Expected Result:');
console.log('  Type: CLAIM_FEES');
console.log('  Token Amount: 398.627855');
console.log('  SOL Amount: 0.007542885');
console.log('  DEX: Meteora');
console.log('  Icon: 💰 FEES');
console.log('  Color: Yellow');

console.log('\n');
