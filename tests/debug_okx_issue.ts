
import { TransactionParser } from '../lib/transactionParser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'repro_okx_issue.json');
const rawData = fs.readFileSync(jsonPath, 'utf-8');
const tx = JSON.parse(rawData);

const tokenMint = '67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev';

console.log('Testing OKX Issue Transaction:', tx.signature);
console.log('Source:', tx.source);

const parsed = TransactionParser.parse(tx, tokenMint);
console.log('\n--- Actual Parser Result ---');
console.log('Type:', parsed?.type);
console.log('DEX:', parsed?.dex);
console.log('SOL Amount:', parsed?.solAmount);
console.log('Token Amount:', parsed?.tokenAmount);
