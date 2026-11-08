const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SIGNATURE = 'XYLDGTfHzKH8KhER3TVg5rsiKVLKJqh2Mpd8SohuzCHRmppyaKkXN7zMcLmP9QfVHq6EB26FHmQNywgHQvFwoVB';

async function fetchTransaction() {
  try {
    console.log('Fetching transaction from Helius API...');
    console.log('Signature:', SIGNATURE);
    
    const response = await axios.post(
      `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`,
      {
        transactions: [SIGNATURE],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const transaction = response.data?.[0];
    
    if (transaction) {
      console.log('\n=== Transaction Data ===\n');
      console.log('Signature:', transaction.signature);
      console.log('Type:', transaction.type);
      console.log('Source:', transaction.source);
      console.log('Fee Payer:', transaction.feePayer);
      console.log('Timestamp:', new Date(transaction.timestamp * 1000).toISOString());
      
      console.log('\n=== Token Transfers ===');
      if (transaction.tokenTransfers) {
        transaction.tokenTransfers.forEach((transfer, i) => {
          console.log(`\nTransfer ${i + 1}:`);
          console.log('  From:', transfer.fromUserAccount);
          console.log('  To:', transfer.toUserAccount);
          console.log('  Amount:', transfer.tokenAmount);
          console.log('  Mint:', transfer.mint);
        });
      }
      
      console.log('\n=== Native Transfers ===');
      if (transaction.nativeTransfers) {
        transaction.nativeTransfers.forEach((transfer, i) => {
          console.log(`\nTransfer ${i + 1}:`);
          console.log('  From:', transfer.fromUserAccount);
          console.log('  To:', transfer.toUserAccount);
          console.log('  Amount (lamports):', transfer.amount);
          console.log('  Amount (SOL):', transfer.amount / 1e9);
        });
      }
      
      console.log('\n=== Account Data ===');
      if (transaction.accountData) {
        transaction.accountData.slice(0, 10).forEach((acc, i) => {
          console.log(`\nAccount ${i + 1}:`);
          console.log('  Address:', acc.account);
          console.log('  Native Balance Change:', acc.nativeBalanceChange);
        });
        if (transaction.accountData.length > 10) {
          console.log(`\n... and ${transaction.accountData.length - 10} more accounts`);
        }
      }
      
      // Save full response to file
      const filename = `helius-tx-${SIGNATURE.substring(0, 8)}.json`;
      fs.writeFileSync(filename, JSON.stringify(transaction, null, 2));
      console.log(`\n✓ Full transaction data saved to: ${filename}`);
      
    } else {
      console.log('Transaction not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

fetchTransaction();
