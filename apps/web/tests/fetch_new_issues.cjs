const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

const TXS = [
    { name: 'issue_liquidity_1', sig: '5eFcnArYFMpECPDYHZVfAFniRn1Sy6BrVQgKspMKsR9zD7zBcrbKr8J7JTRDCE5MtDMSLQ7r2KA9745KvEmHNSm9' },
    { name: 'issue_liquidity_2', sig: '2x3zPUE5u73NekPQydwBRtyiAPAgFoNwREYFvef1CjyyxeMLwydGsqpoBJypastd3SaEDDgJoguxCquKsoBSqNAv' },
    { name: 'issue_zero_sol', sig: '3WygtvC4ZF4jr9JadmbZKwaW75J1X1bimZbtoSfNgz4yyn1t4dZqGYqCJ6RKR5qLnG7789fFb827yVLin7hz8yix' }
];

async function fetchTransactions() {
  try {
    console.log('Fetching transactions from Helius API...');
    
    const response = await axios.post(
      `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${HELIUS_API_KEY}`,
      {
        transactions: TXS.map(t => t.sig),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const transactions = response.data;
    
    if (transactions && transactions.length > 0) {
        transactions.forEach(tx => {
            const match = TXS.find(t => t.sig === tx.signature);
            if (match) {
                const filename = path.join(__dirname, `${match.name}.json`);
                fs.writeFileSync(filename, JSON.stringify(tx, null, 2));
                console.log(`Saved ${match.name} to ${filename}`);
                console.log(`Type: ${tx.type}, Source: ${tx.source}`);
            }
        });
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

fetchTransactions();
