const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SIGNATURE = '4J1QGnR8UYVubwsWps8HTce8DDVuTeKr22ZrK9vSUfdg1Tj3jsHaVyWF6AiJcQszhccLi5cdhTh2tcp576EUYnHo';

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
      const outputPath = path.join(__dirname, 'issue_pump_mismatch.json');
      fs.writeFileSync(outputPath, JSON.stringify(transaction, null, 2));
      console.log(`Transaction saved to ${outputPath}`);
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
