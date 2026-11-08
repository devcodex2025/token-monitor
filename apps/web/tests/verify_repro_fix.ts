
import { TransactionParser } from '../lib/transactionParser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'repro_wrong_direction.json');
const rawData = fs.readFileSync(jsonPath, 'utf-8');
const transaction = JSON.parse(rawData);

const tokenMint = '67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev'; // From the transaction

console.log('Testing transaction:', transaction.signature);
console.log('Token Mint:', tokenMint);

const parsed = TransactionParser.parse(transaction, tokenMint);

console.log('Parsed Type:', parsed?.type);
console.log('Parsed SOL Amount:', parsed?.solAmount);
console.log('Parsed Token Amount:', parsed?.tokenAmount);

if (parsed?.type === 'BUY') {
    console.log('SUCCESS: Correctly identified as BUY');
} else {
    console.log('FAILURE: Incorrectly identified as', parsed?.type);
}
