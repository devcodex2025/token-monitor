
import { TransactionParser } from '../lib/transactionParser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'repro_zero_sol.json');
const rawData = fs.readFileSync(jsonPath, 'utf-8');
const transactions = JSON.parse(rawData);
const tx = transactions[0]; // The one with 0 SOL

const tokenMint = '67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev';

console.log('Testing Zero SOL Transaction:', tx.signature);
console.log('Fee Payer:', tx.feePayer);

// Manually simulate what parse does
const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
// We know the bonding curve address from previous tests
const bondingCurveAddress = 'Apx1URLwFyS1L2kGgXxiR7qgweQ38TCbZuaZQPH9oL99'; 

const curveTransfer = tx.tokenTransfers?.find((t: any) => 
    t.mint === tokenMint && 
    (t.fromUserAccount === bondingCurveAddress || t.toUserAccount === bondingCurveAddress)
);

console.log('Curve Transfer:', curveTransfer);

if (curveTransfer) {
    let type: 'BUY' | 'SELL' = 'BUY';
    let wallet = '';
    
    if (curveTransfer.fromUserAccount === bondingCurveAddress) {
        type = 'BUY';
        wallet = curveTransfer.toUserAccount;
    } else {
        type = 'SELL';
        wallet = curveTransfer.fromUserAccount;
    }
    
    console.log('Detected Type:', type);
    console.log('Detected Wallet:', wallet);
    
    // Simulate createTransaction logic
    let solAmount = 0;
    if (tx.nativeTransfers) {
        for (const transfer of tx.nativeTransfers) {
            console.log(`Checking transfer: ${transfer.fromUserAccount} -> ${transfer.toUserAccount} (${transfer.amount})`);
            
            if (type === 'BUY') {
                if (transfer.fromUserAccount === wallet) {
                    console.log('  MATCH (BUY): Adding amount');
                    solAmount += transfer.amount;
                } else {
                    console.log(`  NO MATCH: ${transfer.fromUserAccount} !== ${wallet}`);
                }
            } else {
                if (transfer.toUserAccount === wallet) {
                    console.log('  MATCH (SELL): Adding amount');
                    solAmount += transfer.amount;
                } else {
                    console.log(`  NO MATCH: ${transfer.toUserAccount} !== ${wallet}`);
                }
            }
        }
        solAmount = solAmount / 1e9;
    }
    console.log('Calculated SOL Amount:', solAmount);
}

// Now run the actual parser
const parsed = TransactionParser.parse(tx, tokenMint);
console.log('\n--- Actual Parser Result ---');
console.log('Type:', parsed?.type);
console.log('Wallet:', parsed?.wallet);
console.log('SOL Amount:', parsed?.solAmount);
