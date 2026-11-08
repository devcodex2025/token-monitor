const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const TX_SIGNATURE = '45xB9ojqpXeisbZ5wgArF8TSHHGLXpDvh3UNAgTSotLTB6jmke93YZrzkDDG6Y1CH39MejvougrMRYQyVcGWyKpb';

async function fetchTransaction() {
  try {
    console.log(`Fetching transaction ${TX_SIGNATURE}...`);
    const response = await axios.post(
      `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${HELIUS_API_KEY}`,
      { transactions: [TX_SIGNATURE] },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const transaction = response.data?.[0];
    if (transaction) {
      fs.writeFileSync(
        path.join(__dirname, 'repro_pump_zero_sol_2.json'), 
        JSON.stringify(transaction, null, 2)
      );
      console.log('Saved to tests/repro_pump_zero_sol_2.json');
    }
  } catch (error) {
    console.error('Error fetching transaction:', error.message);
  }
}

fetchTransaction();
