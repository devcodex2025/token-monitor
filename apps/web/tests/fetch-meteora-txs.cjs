const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

if (!HELIUS_API_KEY) {
    console.error('HELIUS_API_KEY not found in .env.local');
    process.exit(1);
}

const TRANSACTIONS = [
    {
        name: 'meteora-swap',
        signature: 'xx3sKMmRMnyBhhzgnQDRHex9hjeTuTB183YdKrbE4uDEsKSiB6MrZuQBtbMQaWPQwnDbs7LWDxCjVkZYfoU1cpB'
    },
    {
        name: 'meteora-add-liquidity',
        signature: '4MW7EDV37iEus5an7L3jajXHC3KgRdsSsCh6MNKYXDT4yjqMQXxvGUpHXTsRxwXJesYs6v8nxr6MMA1JqLaXuVHQ'
    },
    {
        name: 'meteora-remove-liquidity',
        signature: '4FAggWpnzGv6rSwxEPum8nJT6K6ctVVr3zRL6yKU6kchRkcYF1Lbtu7wwvtSrHPkSt3pwvNuMsPGs4uMHoLtLn1s'
    }
];

async function fetchAndSaveTransactions() {
    console.log('Fetching transactions from Helius API...');

    for (const tx of TRANSACTIONS) {
        try {
            console.log(`Fetching ${tx.name} (${tx.signature})...`);
            const response = await axios.post(
                `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`,
                {
                    transactions: [tx.signature],
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            const transactionData = response.data?.[0];

            if (transactionData) {
                const filePath = path.join(__dirname, `${tx.name}.json`);
                fs.writeFileSync(filePath, JSON.stringify(transactionData, null, 2));
                console.log(`Saved ${tx.name} to ${filePath}`);
            } else {
                console.error(`Failed to fetch data for ${tx.name}`);
            }

        } catch (error) {
            console.error(`Error fetching ${tx.name}:`, error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
        }
    }
}

fetchAndSaveTransactions();
