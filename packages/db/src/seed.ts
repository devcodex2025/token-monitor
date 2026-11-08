import { createDatabase, schema } from './index'
import 'dotenv/config'

/**
 * Demo seed (AC-A2.1): one org with an active Turbo subscription and an Owner Boost
 * on the demo mint.
 */
const DEMO_ORG_ID = '00000000-0000-4000-8000-000000000001'
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000002'
const DEMO_BOOST_ID = '00000000-0000-4000-8000-000000000003'
const DEMO_TURBO_SUB_ID = '00000000-0000-4000-8000-000000000004'
const DEMO_BOOST_SUB_ID = '00000000-0000-4000-8000-000000000005'

const DEMO_WALLET = 'DemoWa11et1111111111111111111111111111111111'
const DEMO_MINT = 'CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump'
const DEMO_DEV_WALLET = 'DemoDev1111111111111111111111111111111111111'

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required to seed the database')
  }

  const { db, pool } = createDatabase(url)
  const now = new Date()
  const prepaidUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  try {
    await db.insert(schema.orgs)
      .values({ id: DEMO_ORG_ID, name: 'Demo Org', wallet: DEMO_WALLET })
      .onConflictDoUpdate({ target: schema.orgs.id, set: { name: 'Demo Org' } })

    await db.insert(schema.users)
      .values({ id: DEMO_USER_ID, wallet: DEMO_WALLET })
      .onConflictDoUpdate({ target: schema.users.id, set: { wallet: DEMO_WALLET } })

    await db.insert(schema.orgMembers)
      .values({ orgId: DEMO_ORG_ID, userId: DEMO_USER_ID, role: 'owner' })
      .onConflictDoNothing()

    await db.insert(schema.tokens)
      .values({
        mint: DEMO_MINT,
        symbol: 'DEMO',
        name: 'Demo Token',
        decimals: 6,
        dex: 'Pump.fun',
        devWallet: DEMO_DEV_WALLET,
      })
      .onConflictDoUpdate({
        target: schema.tokens.mint,
        set: { symbol: 'DEMO', name: 'Demo Token' },
      })

    await db.insert(schema.boostItems)
      .values({
        id: DEMO_BOOST_ID,
        orgId: DEMO_ORG_ID,
        mint: DEMO_MINT,
        verified: true,
        custom: {
          description: 'Demo Boosted token',
          logo: '',
          socials: {},
          cta: [{ label: 'Website', url: 'https://tmr.watch' }],
        },
        active: true,
        expiresAt: prepaidUntil,
      })
      .onConflictDoUpdate({
        target: schema.boostItems.id,
        set: { active: true, verified: true, expiresAt: prepaidUntil },
      })

    await db.insert(schema.subscriptions)
      .values({
        id: DEMO_TURBO_SUB_ID,
        orgId: DEMO_ORG_ID,
        plan: 'turbo',
        status: 'active',
        prepaidUntil,
        period: { days: 30 },
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.id,
        set: { plan: 'turbo', status: 'active', prepaidUntil },
      })

    await db.insert(schema.subscriptions)
      .values({
        id: DEMO_BOOST_SUB_ID,
        orgId: DEMO_ORG_ID,
        plan: 'boost',
        status: 'active',
        prepaidUntil,
        period: { days: 30, mint: DEMO_MINT },
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.id,
        set: { plan: 'boost', status: 'active', prepaidUntil },
      })

    console.log(`Seeded demo org ${DEMO_ORG_ID} (turbo + boost on ${DEMO_MINT})`)
  }
  finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
