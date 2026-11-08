-- PRD §5: pgvector is required for the AI semantic cache.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "ai_cache" (
	"context_hash" text PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"mint" text,
	"payload" jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"label" text,
	"balance" numeric(20, 6) DEFAULT '0' NOT NULL,
	"rate_limit_ppm" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "boost_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mint" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"custom" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target" jsonb,
	"secret" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid,
	"event_id" bigint,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holder_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"mint" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"top" jsonb
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_members_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"wallet" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" text NOT NULL,
	"plan" text NOT NULL,
	"period_days" integer NOT NULL,
	"asset" text NOT NULL,
	"amount_requested" numeric(20, 9) NOT NULL,
	"tx_signature" text,
	"verified_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_invoice_id_unique" UNIQUE("invoice_id"),
	CONSTRAINT "payments_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mint" text,
	"type" text NOT NULL,
	"params" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"prepaid_until" timestamp with time zone,
	"period" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_daily" (
	"mint" text NOT NULL,
	"day" date NOT NULL,
	"volume_sol" numeric(20, 9) DEFAULT '0',
	"buys" integer DEFAULT 0,
	"sells" integer DEFAULT 0,
	"unique_wallets" integer DEFAULT 0,
	"net_flow_sol" numeric(20, 9) DEFAULT '0',
	CONSTRAINT "token_daily_mint_day_pk" PRIMARY KEY("mint","day")
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"mint" text PRIMARY KEY NOT NULL,
	"symbol" text,
	"name" text,
	"decimals" integer,
	"logo_uri" text,
	"dex" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dev_wallet" text
);
--> statement-breakpoint
CREATE TABLE "tx_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"mint" text NOT NULL,
	"event_type" text NOT NULL,
	"dex" text,
	"slot" bigint,
	"block_time" timestamp with time zone NOT NULL,
	"wallet" text NOT NULL,
	"sol_amount" numeric(20, 9),
	"token_amount" numeric(38, 0),
	"price" numeric(20, 12),
	"fee_sol" numeric(20, 9),
	"signature" text NOT NULL,
	"related_wallets" jsonb,
	"raw" jsonb,
	CONSTRAINT "tx_events_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet" text,
	"tg_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
CREATE TABLE "wallet_stats" (
	"wallet" text PRIMARY KEY NOT NULL,
	"first_seen" timestamp with time zone,
	"last_seen" timestamp with time zone,
	"funding_parent" text,
	"funding_slot" bigint,
	"totals" jsonb,
	"tags" text[] DEFAULT '{}'::text[]
);
--> statement-breakpoint
CREATE TABLE "wallet_token_stats" (
	"wallet" text NOT NULL,
	"mint" text NOT NULL,
	"buy_sol" numeric(20, 9) DEFAULT '0',
	"sell_sol" numeric(20, 9) DEFAULT '0',
	"buy_token" numeric(38, 0) DEFAULT '0',
	"sell_token" numeric(38, 0) DEFAULT '0',
	"first_buy_at" timestamp with time zone,
	"last_sell_at" timestamp with time zone,
	CONSTRAINT "wallet_token_stats_wallet_mint_pk" PRIMARY KEY("wallet","mint")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boost_items" ADD CONSTRAINT "boost_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boost_items" ADD CONSTRAINT "boost_items_mint_tokens_mint_fk" FOREIGN KEY ("mint") REFERENCES "public"."tokens"("mint") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_event_id_tx_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."tx_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_org_created_idx" ON "ai_usage" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "boost_items_mint_idx" ON "boost_items" USING btree ("mint");--> statement-breakpoint
CREATE INDEX "delivery_log_created_idx" ON "delivery_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "holder_snapshots_mint_captured_idx" ON "holder_snapshots" USING btree ("mint","captured_at");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "payments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "tx_events_mint_block_time_idx" ON "tx_events" USING btree ("mint","block_time" desc);--> statement-breakpoint
CREATE INDEX "tx_events_wallet_block_time_idx" ON "tx_events" USING btree ("wallet","block_time" desc);