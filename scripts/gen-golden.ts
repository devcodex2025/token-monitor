/**
 * Generates the golden snapshot for the parser from the legacy oracle.
 * Usage: pnpm exec tsx scripts/gen-golden.ts
 *
 * The legacy parser in legacy-token-monitor-2/ is the behavioural oracle.
 * The ported parser in packages/parser must match it (AC-A1.1).
 */
import fs from 'node:fs'
import path from 'node:path'
import { TransactionParser as LegacyParser } from '../legacy-token-monitor-2/lib/transactionParser'
import type { HeliusTransaction, LegacyTransaction } from '../packages/parser/src/types'
import { TransactionParser as PortedParser } from '../packages/parser/src/transactionParser'

const FIXTURE_DIR = path.resolve('packages/parser/__fixtures__')
const OUT_FILE = path.join(FIXTURE_DIR, 'golden.json')

const STABLE_MINTS = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
])

/** LP fixtures carry the monitored token only in instruction accounts. */
const MINT_OVERRIDES: Record<string, string> = {
  'meteora-add-liquidity.json': 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump',
  'test-add-liquidity.json': 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump',
  'test-remove-liq-real.json': 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump',
  'test-remove-liq.json': 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump',
}

interface GoldenEntry {
  fixture: string
  arrayIndex: number
  mint: string
  type: LegacyTransaction['type']
  dex: string
  wallet: string
  solAmount: number
  tokenAmount: number
}

function inferMint(tx: HeliusTransaction): string | null {
  const candidates: string[] = []
  for (const transfer of tx.tokenTransfers ?? []) candidates.push(transfer.mint)
  for (const account of tx.accountData ?? []) {
    for (const change of account.tokenBalanceChanges ?? []) candidates.push(change.mint)
  }
  return candidates.find(mint => !STABLE_MINTS.has(mint)) ?? null
}

function pick(target: LegacyTransaction | null, field: keyof LegacyTransaction): unknown {
  return target ? target[field] : null
}

function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9
}

const files = fs.readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.json') && f !== 'golden.json')
const golden: GoldenEntry[] = []
const mismatches: string[] = []
const skipped: string[] = []

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'))
  const arrayIndex = Array.isArray(raw) ? 0 : -1
  const tx = (Array.isArray(raw) ? raw[0] : raw) as HeliusTransaction

  if (!tx?.tokenTransfers && !tx?.accountData) {
    skipped.push(`${file} (not an Enhanced transaction payload)`)
    continue
  }

  const mint = MINT_OVERRIDES[file] ?? inferMint(tx)
  if (!mint) {
    skipped.push(`${file} (no non-stable mint found)`)
    continue
  }

  const legacy = LegacyParser.parse(tx, mint)
  const ported = PortedParser.parse(tx, mint)

  if (!legacy && !ported) {
    skipped.push(`${file} (both parsers returned null)`)
    continue
  }

  const checks: Array<[string, boolean]> = [
    ['type', pick(legacy, 'type') === pick(ported, 'type')],
    ['dex', pick(legacy, 'dex') === pick(ported, 'dex')],
    ['wallet', pick(legacy, 'wallet') === pick(ported, 'wallet')],
    ['solAmount', closeEnough((legacy?.solAmount ?? 0), (ported?.solAmount ?? 0))],
    ['tokenAmount', closeEnough((legacy?.tokenAmount ?? 0), (ported?.tokenAmount ?? 0))],
  ]

  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
  if (failed.length > 0) {
    mismatches.push(
      `${file}: ${failed.join(', ')}\n  legacy=${JSON.stringify(legacy)}\n  ported=${JSON.stringify(ported)}`,
    )
  }

  if (legacy) {
    golden.push({
      fixture: file,
      arrayIndex,
      mint,
      type: legacy.type,
      dex: legacy.dex ?? '',
      wallet: legacy.wallet,
      solAmount: legacy.solAmount,
      tokenAmount: legacy.tokenAmount,
    })
  }
}

fs.writeFileSync(OUT_FILE, `${JSON.stringify(golden, null, 2)}\n`)

console.log(`Golden entries: ${golden.length}`)
console.log(`Skipped: ${skipped.length}`)
for (const entry of skipped) console.log(`  - ${entry}`)

if (mismatches.length > 0) {
  console.error(`\nMISMATCHES (${mismatches.length}):`)
  for (const mismatch of mismatches) console.error(`- ${mismatch}`)
  process.exitCode = 1
} else {
  console.log('\nLegacy and ported parsers match on every fixture.')
}
