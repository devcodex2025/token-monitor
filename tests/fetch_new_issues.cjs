const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

const TX_MISSING_WALLET = [
  'VTaKi39hVJgScchjxrdwfDZQTWXtuDs2T8PRb1vWKUBY6Ney34JXYyryVfngpVPcKQ8bwXYvuzqDtaikxrN3wue',
  'Fr6Yt287vh7JBZywEHwDQUAMMpuKACeaN2Efg1wnhKePM9oC8dwpkbscX1wRorW2M16QCf9teSpc5C5kusniU24'
];

const TX_ZERO_SOL = [
  '4eeETyebNBbTeNj8oGNdSw6U4s9aM46dkhFLSW3B9iDZEEtVx7d4Xi9kAmycSMDcATuRAyCMULojyzEXxuVAqdq5',
  '5HT6vTewx4KGm2cWSDmzDaECB5N7jiYiHVXLM7MuXp7PAshqAeARZ2iMPgAiT7hRWLnHAueycXmDPhLe6AiiwkML'
];

async function fetchTransactions(signatures, label) {
  try {
    console.log(`Fetching ${label} transactions...`);
    
    const response = await axios.post(
      `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${HELIUS_API_KEY}`,
      {
        transactions: signatures,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const transactions = response.data;
    
    fs.writeFileSync(
      path.join(__dirname, `repro_${label.toLowerCase().replace(' ', '_')}.json`), 
      JSON.stringify(transactions, null, 2)
    );
    console.log(`Saved to tests/repro_${label.toLowerCase().replace(' ', '_')}.json`);
    
    return transactions;
  } catch (error) {
    console.error(`Error fetching ${label}:`, error.message);
  }
}

async function run() {
  await fetchTransactions(TX_MISSING_WALLET, 'MISSING_WALLET');
  await fetchTransactions(TX_ZERO_SOL, 'ZERO_SOL');
}

run();
