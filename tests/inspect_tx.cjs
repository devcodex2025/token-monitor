const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SIGNATURE = '4eHxwCTfSBdCEtfe58Nepq6L5R6iVMmCUbdkpqADb6oVP9dKUUmfp23mT5oEAU4oVLP6FU1uAXkrWsQ3EynKNTi7';

async function fetchTransaction() {
  if (!HELIUS_API_KEY) {
    console.error('Error: HELIUS_API_KEY not found in .env.local');
    process.exit(1);
  }

  try {
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
        console.log(JSON.stringify(transaction, null, 2));
    } else {
      console.log('Transaction not found');
    }
  } catch (error) {
    console.error('Error fetching transaction:', error.message);
  }
}

fetchTransaction();
