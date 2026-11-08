import { Transaction, HeliusTransaction } from '../../types';

export interface TransactionParserInterface {
  parse(heliusTx: HeliusTransaction, tokenMint: string): Transaction | null;
}
