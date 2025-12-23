import { HeliusTransaction, Transaction } from '../../types';
import { BaseParser } from './base';
import { PublicKey } from '@solana/web3.js';

export class PumpFunParser extends BaseParser {
  private static PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

  canParse(transaction: HeliusTransaction): boolean {
    const { source, instructions } = transaction;
    return (
      source === 'PUMP_FUN' ||
      instructions?.some((ix: any) => ix.programId === PumpFunParser.PUMP_FUN_PROGRAM_ID) ||
      false
    );
  }

  parse(transaction: HeliusTransaction, tokenMint: string): Transaction | null {
    try {
      const { tokenTransfers } = transaction;
      
      // Derive Bonding Curve Address
      const PUMP_FUN_PROGRAM = new PublicKey(PumpFunParser.PUMP_FUN_PROGRAM_ID);
      const [bondingCurve] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), new PublicKey(tokenMint).toBuffer()],
        PUMP_FUN_PROGRAM
      );
      const bondingCurveAddress = bondingCurve.toBase58();

      // Find the token transfer involving the bonding curve
      const curveTransfer = tokenTransfers?.find(t => 
        t.mint === tokenMint && 
        (t.fromUserAccount === bondingCurveAddress || t.toUserAccount === bondingCurveAddress)
      );

      if (!curveTransfer) {
        return null;
      }

      let type: 'BUY' | 'SELL';
      let wallet: string;

      // Determine direction based on flow relative to Bonding Curve
      if (curveTransfer.fromUserAccount === bondingCurveAddress) {
        // Bonding Curve sends tokens -> User BUYS
        type = 'BUY';
        wallet = curveTransfer.toUserAccount;
      } else {
        // User sends tokens to Bonding Curve -> User SELLS
        type = 'SELL';
        wallet = curveTransfer.fromUserAccount;
      }

      // Calculate SOL amount based on transfers to/from bonding curve
      // This is more reliable than summing user transfers as it captures the actual trade value
      let solAmount = 0;
      if (transaction.nativeTransfers) {
        for (const transfer of transaction.nativeTransfers) {
          if (type === 'BUY' && transfer.toUserAccount === bondingCurveAddress) {
            solAmount += transfer.amount;
          } else if (type === 'SELL' && transfer.fromUserAccount === bondingCurveAddress) {
            solAmount += transfer.amount;
          }
        }
        if (solAmount > 0) {
          solAmount = solAmount / 1e9;
        }
      }

      return this.createTransaction(
        transaction,
        type,
        wallet,
        curveTransfer.tokenAmount,
        tokenMint,
        'Pump.fun',
        solAmount // Pass calculated amount
      );
    } catch (error) {
      console.error('Error parsing Pump.fun transaction:', error);
      return null;
    }
  }
}
