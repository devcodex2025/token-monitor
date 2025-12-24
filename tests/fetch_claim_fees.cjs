
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SIG = '2DEiQ9CG1mfPKGb5zqsnnYLfHDGH5YHQLQV3SeMzinX87fQtpLeNrbRjxFVBZznMhovDPZJ6SFvogoGAFH6yQRVV';

async function fetchTransaction() {
  try {
    console.log('Fetching transaction from Helius API...');
    
    const response = await axios.post(
      `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${HELIUS_API_KEY}`,
      {
        transactions: [SIG],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const transactions = response.data;
    
    if (transactions && transactions.length > 0) {
        const tx = transactions[0];
        const filename = path.join(__dirname, 'issue_claim_fees.json');
        fs.writeFileSync(filename, JSON.stringify(tx, null, 2));
        console.log(`Saved transaction to ${filename}`);
        console.log(`Type: ${tx.type}, Source: ${tx.source}`);
    } else {
        console.log('No transactions found');
    }

  } catch (error) {
    console.error('Error fetching transaction:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

fetchTransaction();
