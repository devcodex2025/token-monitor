
import { TransactionParser } from '../lib/transactionParser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'repro_missing_wallet.json');
const rawData = fs.readFileSync(jsonPath, 'utf-8');
const transactions = JSON.parse(rawData);
const tx = transactions[0]; // VTaKi39...

const tokenMint = '67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev';

console.log('Testing Missing Wallet Transaction:', tx.signature);

const parsed = TransactionParser.parse(tx, tokenMint);
console.log('\n--- Actual Parser Result ---');
console.log('Type:', parsed?.type);
console.log('Wallet:', parsed?.wallet);
console.log('SOL Amount:', parsed?.solAmount);
