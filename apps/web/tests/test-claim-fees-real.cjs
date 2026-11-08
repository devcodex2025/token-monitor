const fs = require('fs');
const path = require('path');

const tx = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-claim-fees-real.json')))[0];
const tokenMint = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump';

console.log('=== Real Claim Fees Transaction Analysis ===');
console.log('Signature:', tx.signature.slice(0, 20) + '...');
console.log('Type:', tx.type);
console.log('Source:', tx.source);
console.log('FeePayer:', tx.feePayer);
console.log();

console.log('Token Transfers:');
tx.tokenTransfers?.forEach((t, i) => {
  console.log(`  ${i}. ${t.mint === tokenMint ? 'OUR TOKEN' : 'WSOL'}`);
  console.log(`     FROM: ${t.fromUserAccount}`);
  console.log(`     TO: ${t.toUserAccount}`);
  console.log(`     Amount: ${t.tokenAmount}`);
  console.log(`     TO is FeePayer: ${t.toUserAccount === tx.feePayer}`);
  console.log(`     FROM is FeePayer: ${t.fromUserAccount === tx.feePayer}`);
});

console.log();
console.log('Expected Result:');
console.log('  Type: CLAIM_FEES');
console.log('  Both transfers TO user (not FROM user)');
console.log('  Should show 💰 FEES badge');
