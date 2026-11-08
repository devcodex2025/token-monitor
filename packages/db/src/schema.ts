import { desc, sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'

/* ─── Identity ─────────────────────────────────────────────────────────────── */

export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  wallet: text('wallet').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  wallet: text('wallet').unique(),
  tgChatId: text('tg_chat_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orgMembers = pgTable('org_members', {
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.orgId, table.userId] })])

/* ─── Tokens ───────────────────────────────────────────────────────────────── */

export const tokens = pgTable('tokens', {
  mint: text('mint').primaryKey(),
  symbol: text('symbol'),
  name: text('name'),
  decimals: integer('decimals'),
  logoUri: text('logo_uri'),
  dex: text('dex'),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
  devWallet: text('dev_wallet'),
})

export const boostItems = pgTable('boost_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  mint: text('mint').notNull().references(() => tokens.mint, { onDelete: 'cascade' }),
  verified: boolean('verified').notNull().default(false),
  custom: jsonb('custom'),
  active: boolean('active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('boost_items_mint_idx').on(table.mint)])

/* ─── Events ───────────────────────────────────────────────────────────────── */

export const txEvents = pgTable('tx_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  mint: text('mint').notNull(),
  eventType: text('event_type').notNull(),
  dex: text('dex'),
  slot: bigint('slot', { mode: 'number' }),
  blockTime: timestamp('block_time', { withTimezone: true }).notNull(),
  wallet: text('wallet').notNull(),
  solAmount: numeric('sol_amount', { precision: 20, scale: 9 }),
  tokenAmount: numeric('token_amount', { precision: 38, scale: 0 }),
  price: numeric('price', { precision: 20, scale: 12 }),
  feeSol: numeric('fee_sol', { precision: 20, scale: 9 }),
  signature: text('signature').notNull().unique(),
  relatedWallets: jsonb('related_wallets'),
  raw: jsonb('raw'),
}, table => [
  index('tx_events_mint_block_time_idx').on(table.mint, desc(table.blockTime)),
  index('tx_events_wallet_block_time_idx').on(table.wallet, desc(table.blockTime)),
])

export const walletStats = pgTable('wallet_stats', {
  wallet: text('wallet').primaryKey(),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  fundingParent: text('funding_parent'),
  fundingSlot: bigint('funding_slot', { mode: 'number' }),
  totals: jsonb('totals'),
  tags: text('tags').array().default(sql`'{}'::text[]`),
})

export const walletTokenStats = pgTable('wallet_token_stats', {
  wallet: text('wallet').notNull(),
  mint: text('mint').notNull(),
  buySol: numeric('buy_sol', { precision: 20, scale: 9 }).default('0'),
  sellSol: numeric('sell_sol', { precision: 20, scale: 9 }).default('0'),
  buyToken: numeric('buy_token', { precision: 38, scale: 0 }).default('0'),
  sellToken: numeric('sell_token', { precision: 38, scale: 0 }).default('0'),
  firstBuyAt: timestamp('first_buy_at', { withTimezone: true }),
  lastSellAt: timestamp('last_sell_at', { withTimezone: true }),
}, table => [primaryKey({ columns: [table.wallet, table.mint] })])

export const tokenDaily = pgTable('token_daily', {
  mint: text('mint').notNull(),
  day: date('day').notNull(),
  volumeSol: numeric('volume_sol', { precision: 20, scale: 9 }).default('0'),
  buys: integer('buys').default(0),
  sells: integer('sells').default(0),
  uniqueWallets: integer('unique_wallets').default(0),
  netFlowSol: numeric('net_flow_sol', { precision: 20, scale: 9 }).default('0'),
}, table => [primaryKey({ columns: [table.mint, table.day] })])

export const holderSnapshots = pgTable('holder_snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  mint: text('mint').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  top: jsonb('top'),
}, table => [index('holder_snapshots_mint_captured_idx').on(table.mint, table.capturedAt)])

/* ─── Rules & delivery ─────────────────────────────────────────────────────── */

export const rules = pgTable('rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  mint: text('mint'),
  type: text('type').notNull(),
  params: jsonb('params'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  target: jsonb('target'),
  secret: text('secret'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const deliveryLog = pgTable('delivery_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id').references(() => rules.id, { onDelete: 'set null' }),
  eventId: bigint('event_id', { mode: 'number' }).references(() => txEvents.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('delivery_log_created_idx').on(table.createdAt)])

/* ─── Billing ──────────────────────────────────────────────────────────────── */

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  status: text('status').notNull().default('active'),
  prepaidUntil: timestamp('prepaid_until', { withTimezone: true }),
  period: jsonb('period'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('subscriptions_org_idx').on(table.orgId)])

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  invoiceId: text('invoice_id').notNull().unique(),
  plan: text('plan').notNull(),
  periodDays: integer('period_days').notNull(),
  asset: text('asset').notNull(),
  amountRequested: numeric('amount_requested', { precision: 20, scale: 9 }).notNull(),
  txSignature: text('tx_signature').unique(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  status: text('status').notNull().default('pending'),
  memo: text('memo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('payments_org_idx').on(table.orgId)])

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  label: text('label'),
  balance: numeric('balance', { precision: 20, scale: 6 }).notNull().default('0'),
  rateLimitPpm: integer('rate_limit_ppm'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/* ─── AI ───────────────────────────────────────────────────────────────────── */

export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('ai_usage_org_created_idx').on(table.orgId, table.createdAt)])

export const aiCache = pgTable('ai_cache', {
  contextHash: text('context_hash').primaryKey(),
  feature: text('feature').notNull(),
  mint: text('mint'),
  payload: jsonb('payload'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
