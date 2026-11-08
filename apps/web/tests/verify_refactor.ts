
import fs from 'fs';
import path from 'path';
import { TransactionParser } from '../lib/transactionParser';
import { HeliusTransaction } from '../types';

const filename = process.argv[2] || 'tests/repro_pump_zero_sol_2.json';
const REPRO_FILE = path.join(process.cwd(), filename);

async function runTest() {
  try {
    if (!fs.existsSync(REPRO_FILE)) {
      console.error(`File not found: ${REPRO_FILE}`);
      return;
    }

    const txData = JSON.parse(fs.readFileSync(REPRO_FILE, 'utf8'));
    // Handle both array and single object
    const tx = Array.isArray(txData) ? txData[0] : txData;

    console.log(`Testing transaction: ${tx.signature}`);

    // Use a dummy token mint if not known, or try to infer
    // For Pump.fun, the token mint is usually in the token transfers
    // Let's try to find a mint that is NOT SOL/USDC/USDT
    const KNOWN_MINTS = [
      'So11111111111111111111111111111111111111112', // WSOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    ];

    let tokenMint = 'Unknown';
    if (tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        if (!KNOWN_MINTS.includes(t.mint)) {
          tokenMint = t.mint;
          break;
        }
      }
    }
    
    console.log(`Inferred Token Mint: ${tokenMint}`);

    const result = TransactionParser.parse(tx, tokenMint);

    console.log('---------------------------------------------------');
    console.log('PARSING RESULT:');
    console.log(JSON.stringify(result, null, 2));
    console.log('---------------------------------------------------');

    if (result) {
        console.log(`Type: ${result.type}`);
        console.log(`Wallet: ${result.wallet}`);
        console.log(`SOL Amount: ${result.solAmount}`);
        console.log(`Token Amount: ${result.tokenAmount}`);
        console.log(`DEX: ${result.dex}`);
        
        if (result.solAmount === 0) {
            console.warn('WARNING: SOL Amount is 0!');
        }
        if (!result.wallet) {
            console.warn('WARNING: Wallet is missing!');
        }
    } else {
        console.error('FAILED to parse transaction');
    }

  } catch (error) {
    console.error('Error running test:', error);
  }
}

runTest();
