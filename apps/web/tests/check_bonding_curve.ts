
import { PublicKey } from '@solana/web3.js';

const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const tokenMint = new PublicKey('67ipDsgK6D7bqTW89H8T1KTxUvVuaFy92GX7Q2XFVdev');

const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), tokenMint.toBuffer()],
    PUMP_FUN_PROGRAM
);

console.log('Mint:', tokenMint.toBase58());
console.log('Derived Bonding Curve:', bondingCurve.toBase58());
console.log('Expected (from tx):', 'Apx1URLwFyS1L2kGgXxiR7qgweQ38TCbZuaZQPH9oL99');
console.log('Match:', bondingCurve.toBase58() === 'Apx1URLwFyS1L2kGgXxiR7qgweQ38TCbZuaZQPH9oL99');
