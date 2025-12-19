require('dotenv').config({ path: '.env.local' });

const signature = '2jTVXxVd3n7rfi1HjNTAP7qZVAECNpTNEWjEim39mKWqALoDUvsDYvtCSEUwoaEM9GwPkrutAHR4JVZzehnnkoQo';
const url = `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${process.env.HELIUS_API_KEY}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ transactions: [signature] })
})
  .then(r => r.json())
  .then(d => {
    const tx = d[0];
    console.log('=== TRANSACTION DATA ===');
    console.log('Signature:', tx.signature);
    console.log('Type:', tx.type);
    console.log('FeePayer:', tx.feePayer);
    console.log('Source:', tx.source);
    
    console.log('\n=== TOKEN TRANSFERS ===');
    tx.tokenTransfers.forEach((t, i) => {
      console.log(`Transfer ${i+1}:`, {
        mint: t.mint.substring(0, 20) + '...',
        from: t.fromUserAccount?.substring(0, 20) + '...' || 'null',
        to: t.toUserAccount?.substring(0, 20) + '...' || 'null',
        amount: t.tokenAmount
      });
    });
    
    console.log('\n=== NATIVE TRANSFERS ===');
    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      tx.nativeTransfers.forEach((t, i) => {
        console.log(`Transfer ${i+1}:`, {
          from: t.fromUserAccount?.substring(0, 20) + '...' || 'null',
          to: t.toUserAccount?.substring(0, 20) + '...' || 'null',
          amount: t.amount
        });
      });
    }
    
    console.log('\n=== FULL DATA ===');
    console.log(JSON.stringify(tx, null, 2));
  })
  .catch(err => console.error('Error:', err));
