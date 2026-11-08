
import { TransactionParser } from '../lib/transactionParser';
import { PublicKey } from '@solana/web3.js';

// Mock Pump.fun Program ID
const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Generate a random Token Mint
const tokenMint = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'); // Using the one from logs

// Derive Bonding Curve
const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), tokenMint.toBuffer()],
    PUMP_FUN_PROGRAM
);
const bondingCurveAddress = bondingCurve.toBase58();
const userAddress = 'UserWalletAddress11111111111111111111111111';

console.log('Token Mint:', tokenMint.toBase58());
console.log('Bonding Curve:', bondingCurveAddress);

// Mock BUY Transaction (Bonding Curve -> User)
const buyTx = {
    signature: 'buy_signature_123',
    timestamp: 1234567890,
    type: 'UNKNOWN', // Parser should detect BUY
    source: 'PUMP_FUN',
    feePayer: userAddress,
    tokenTransfers: [
        {
            mint: tokenMint.toBase58(),
            fromUserAccount: bondingCurveAddress,
            toUserAccount: userAddress,
            tokenAmount: 1000,
            decimals: 6
        }
    ],
    nativeTransfers: [
        {
            fromUserAccount: userAddress,
            toUserAccount: bondingCurveAddress,
            amount: 1000000000 // 1 SOL
        }
    ],
    instructions: [],
    accountData: []
};

// Mock SELL Transaction (User -> Bonding Curve)
const sellTx = {
    signature: 'sell_signature_123',
    timestamp: 1234567890,
    type: 'UNKNOWN', // Parser should detect SELL
    source: 'PUMP_FUN',
    feePayer: userAddress,
    tokenTransfers: [
        {
            mint: tokenMint.toBase58(),
            fromUserAccount: userAddress,
            toUserAccount: bondingCurveAddress,
            tokenAmount: 1000,
            decimals: 6
        }
    ],
    nativeTransfers: [
        {
            fromUserAccount: bondingCurveAddress,
            toUserAccount: userAddress,
            amount: 1000000000 // 1 SOL
        }
    ],
    instructions: [],
    accountData: []
};

console.log('\n--- Testing BUY Transaction ---');
const parsedBuy = TransactionParser.parse(buyTx as any, tokenMint.toBase58());
console.log('Parsed Type:', parsedBuy?.type);
console.log('Expected: BUY');
console.log('Result:', parsedBuy?.type === 'BUY' ? 'PASS' : 'FAIL');

console.log('\n--- Testing SELL Transaction ---');
const parsedSell = TransactionParser.parse(sellTx as any, tokenMint.toBase58());
console.log('Parsed Type:', parsedSell?.type);
console.log('Expected: SELL');
console.log('Result:', parsedSell?.type === 'SELL' ? 'PASS' : 'FAIL');

// Mock WebSocket Transaction (source: WEBSOCKET, but has Pump.fun instruction)
const wsTx = {
    signature: 'ws_signature_123',
    timestamp: 1234567890,
    type: 'UNKNOWN',
    source: 'WEBSOCKET',
    feePayer: userAddress,
    tokenTransfers: [
        {
            mint: tokenMint.toBase58(),
            fromUserAccount: bondingCurveAddress,
            toUserAccount: userAddress,
            tokenAmount: 500,
            decimals: 6
        }
    ],
    nativeTransfers: [],
    instructions: [
        {
            programId: PUMP_FUN_PROGRAM.toBase58(),
            accounts: [],
            data: ''
        }
    ],
    accountData: []
};

console.log('\n--- Testing WebSocket Transaction (Pump.fun detected via instructions) ---');
const parsedWs = TransactionParser.parse(wsTx as any, tokenMint.toBase58());
console.log('Parsed Type:', parsedWs?.type);
console.log('Expected: BUY');
console.log('Result:', parsedWs?.type === 'BUY' ? 'PASS' : 'FAIL');

