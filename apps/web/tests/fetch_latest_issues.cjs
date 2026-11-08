const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

const TX_PUMP_ISSUE = '36hwEHuDXs6WspSdRHuodag5vfAReG93zDNTNAbgh6fEtMF45P6KWJUue3g3MUWE59Hk3b367mvEaNqtpAzE1dk6';
const TX_OKX_ISSUE = '2fvk73uNsjhuBDM6pFKBiwfwFnZrM7MLHxaxTrZ6rAQiPi2UzMSKZ8AbDFA6xHQSsM1jkjL2dPaMQh2tB18Xqjwg';

async function fetchTransaction(signature, label) {
  try {
    console.log(`Fetching ${label} transaction...`);
    const response = await axios.post(
      `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${HELIUS_API_KEY}`,
      { transactions: [signature] },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const transaction = response.data?.[0];
    if (transaction) {
      fs.writeFileSync(
        path.join(__dirname, `repro_${label.toLowerCase()}.json`), 
        JSON.stringify(transaction, null, 2)
      );
      console.log(`Saved to tests/repro_${label.toLowerCase()}.json`);
      console.log('Source:', transaction.source);
      console.log('Type:', transaction.type);
    }
  } catch (error) {
    console.error(`Error fetching ${label}:`, error.message);
  }
}

async function run() {
  await fetchTransaction(TX_PUMP_ISSUE, 'PUMP_ISSUE');
  await fetchTransaction(TX_OKX_ISSUE, 'OKX_ISSUE');
}

run();
