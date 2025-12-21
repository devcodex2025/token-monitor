const fs = require('fs');

// Read test transaction
const json = JSON.parse(fs.readFileSync('test-remove-liq.json', 'utf8'));
const tx = json[0]; // Changed from json.value[0]

console.log('\n=== Transaction Analysis ===');
console.log('Type:', tx.type);
console.log('Signature:', tx.signature);
console.log('Fee Payer:', tx.feePayer);
console.log('\nToken Transfers:', tx.tokenTransfers?.length || 0);
console.log('\nInstructions:');
tx.instructions?.forEach((ix, idx) => {
  console.log(`  ${idx}. ${ix.programId}`);
  if (ix.programId === 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo') {
    console.log(`     Meteora DLMM instruction with ${ix.innerInstructions?.length || 0} inner instructions`);
    if (ix.accounts) {
      const hasOurToken = ix.accounts.includes('CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump');
      console.log(`     Contains our token: ${hasOurToken}`);
    }
    if (ix.innerInstructions) {
      ix.innerInstructions.forEach((inner, innerIdx) => {
        const hasOurToken = inner.accounts?.includes('CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump');
        console.log(`       ${innerIdx}. ${inner.programId} - Has our token: ${hasOurToken}`);
      });
    }
  }
});

// Check accountData for our token
console.log('\nAccount Balance Changes for our token:');
const ourToken = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump';
tx.accountData?.forEach(acc => {
  if (acc.tokenBalanceChanges && acc.tokenBalanceChanges.length > 0) {
    const ourTokenChanges = acc.tokenBalanceChanges.filter(bc => bc.mint === ourToken);
    if (ourTokenChanges.length > 0) {
      console.log(`  Account ${acc.account}:`);
      ourTokenChanges.forEach(bc => {
        console.log(`    Amount: ${bc.rawTokenAmount.tokenAmount} (raw), Decimals: ${bc.rawTokenAmount.decimals}`);
        const amount = parseFloat(bc.rawTokenAmount.tokenAmount) / Math.pow(10, bc.rawTokenAmount.decimals);
        console.log(`    Calculated: ${amount}`);
      });
    }
  }
});

console.log('\n');
