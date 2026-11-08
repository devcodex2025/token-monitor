import { Buffer } from 'node:buffer'
import bs58 from 'bs58'
import { describe, expect, it } from 'vitest'
import { toTxEvent } from '../src/events'
import { BagsParser } from '../src/parsers/bags'
import type { HeliusTransaction } from '../src/types'

const BAGS_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN'
const CREATE_POOL_DISCRIMINATOR = '8c55d7b06636684f'
const MINT = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump'
const CREATOR = '2oZzcGqQ2v8nJkKmB1wG7tJc6uQn6oQ3v8M7zQhVv8Yp'
const FEE_PAYER = 'BagsFeePayer111111111111111111111111111111'

function createPoolTransaction(): HeliusTransaction {
  return {
    signature: 'synthetic-create-pool',
    timestamp: 1_700_000_000,
    slot: 123,
    type: 'UNKNOWN',
    source: 'BAGS',
    feePayer: FEE_PAYER,
    instructions: [{
      programId: BAGS_PROGRAM,
      data: bs58.encode(Buffer.from(`${CREATE_POOL_DISCRIMINATOR}0000000000000000`, 'hex')),
    }],
    tokenTransfers: [{
      fromUserAccount: '',
      toUserAccount: CREATOR,
      tokenAmount: 1_000_000,
      mint: MINT,
    }],
    nativeTransfers: [{
      fromUserAccount: CREATOR,
      toUserAccount: FEE_PAYER,
      amount: 1_000_000_000,
    }],
  }
}

describe('legacy -> TxEvent taxonomy', () => {
  it('maps Bags CREATE_POOL to mint_created (dev_launch)', () => {
    const parsed = new BagsParser().parse(createPoolTransaction(), MINT)
    expect(parsed).not.toBeNull()
    expect(parsed!.type).toBe('CREATE_POOL')

    const event = toTxEvent(parsed!, { mint: MINT })
    expect(event.type).toBe('mint_created')
    expect(event.mint).toBe(MINT)
    expect(event.wallet).toBe(CREATOR)
  })
})
