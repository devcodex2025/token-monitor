
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TransactionParser } from '../lib/transactionParser';
import { HeliusTransaction } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read test transaction
const jsonPath = path.join(__dirname, 'meteora-add-liquidity.json');
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Handle both array and single object
const tx: HeliusTransaction = Array.isArray(json) ? json[0] : json;

const tokenMint = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump'; 
// Note: In the json file, the mint seems to be CSrwNk... in tokenChanges, but tokenTransfers logic parses based on what matches.
// The transfer in json[0].tokenTransfers has mint So111 for WSOL.
// Let's inspect the file to find the other mint.
// AccountData shows 'CSrwNk...' token balance.

console.log('\n=== Testing Meteora Add Liquidity ===\n');
console.log('Transaction:', tx.signature);

const result = TransactionParser.parse(tx, tokenMint);

console.log('\n=== Parser Result ===\n');
if (result) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Parsed as NULL');
}
