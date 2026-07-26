CREATE TABLE "adapter_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"healthy" boolean NOT NULL,
	"latency_ms" integer NOT NULL,
	"error" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"threshold_lamports" bigint NOT NULL,
	"splits" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tokens" jsonb NOT NULL,
	"total_claimable_lamports" bigint NOT NULL,
	"failed_platforms" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sweeps" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"policy_id" integer,
	"status" text NOT NULL,
	"claimed_lamports" bigint NOT NULL,
	"skim_lamports" bigint NOT NULL,
	"tx_signature" text,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"telegram_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweeps" ADD CONSTRAINT "sweeps_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweeps" ADD CONSTRAINT "sweeps_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_address_idx" ON "wallets" USING btree ("address");