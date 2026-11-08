const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SIGNATURE = '3zBWE99HkBhUhUPNk2z6XNgXGmc23NX28soCCPDYRkEvSBCdA5dPR34b47czKe7v1LxLdci7QwJmTugpVBePDf4Y';

async function fetchTransaction() {
  try {
    console.log('Fetching transaction from Helius API...');
    console.log('Signature:', SIGNATURE);
    
    const response = await axios.post(
      `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${HELIUS_API_KEY}`,
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
      console.log('Type:', transaction.type);
      console.log('Source:', transaction.source);
      console.log('Description:', transaction.description);
      
      console.log('\nToken Transfers:');
      transaction.tokenTransfers?.forEach(t => {
        console.log(`- Mint: ${t.mint}`);
        console.log(`  From: ${t.fromUserAccount}`);
        console.log(`  To:   ${t.toUserAccount}`);
        console.log(`  Amt:  ${t.tokenAmount}`);
      });

      console.log('\nNative Transfers:');
      transaction.nativeTransfers?.forEach(t => {
        console.log(`- From: ${t.fromUserAccount}`);
        console.log(`  To:   ${t.toUserAccount}`);
        console.log(`  Amt:  ${t.amount}`);
      });

      // Save to file for inspection
      fs.writeFileSync(
        path.join(__dirname, 'repro_wrong_direction.json'), 
        JSON.stringify(transaction, null, 2)
      );
      console.log('\nSaved to tests/repro_wrong_direction.json');
    } else {
      console.log('Transaction not found');
    }
  } catch (error) {
    console.error('Error fetching transaction:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

fetchTransaction();
