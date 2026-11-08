import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as schema from '../src/schema'

const tables = Object.values(schema).filter(value => is(value, PgTable))

describe('drizzle schema v1 (PRD §5)', () => {
  it('declares all 18 tables', () => {
    expect(tables).toHaveLength(18)
  })

  it('uses the PRD table names', () => {
    const names = tables.map(table => getTableName(table)).sort()
    expect(names).toEqual([
      'ai_cache',
      'ai_usage',
      'api_keys',
      'boost_items',
      'deliveries',
      'delivery_log',
      'holder_snapshots',
      'org_members',
      'orgs',
      'payments',
      'rules',
      'subscriptions',
      'token_daily',
      'tokens',
      'tx_events',
      'users',
      'wallet_stats',
      'wallet_token_stats',
    ])
  })

  it('keeps signature unique on tx_events for idempotent ingest', () => {
    expect(schema.txEvents.signature.isUnique).toBe(true)
  })
})
