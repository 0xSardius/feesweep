import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Wallets we've seen — scanner users, Telegram-linked, or paid. */
export const wallets = pgTable(
  "wallets",
  {
    id: serial("id").primaryKey(),
    address: text("address").notNull(),
    telegramChatId: text("telegram_chat_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("wallets_address_idx").on(t.address)],
);

/** Scan snapshots — feeds the scanner UI, accrual-rate estimates, and the aggregate-unclaimed metric. */
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  scannedAt: timestamp("scanned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** TokenFeeState[] with lamport bigints serialized as strings. */
  tokens: jsonb("tokens").notNull(),
  totalClaimableLamports: bigint("total_claimable_lamports", {
    mode: "bigint",
  }).notNull(),
  failedPlatforms: text("failed_platforms").array().notNull().default([]),
});

/** Autopilot policies (week 2). Splits: [{kind: 'usdc'|'sol'|'dividend', pct, destination}]. */
export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id")
    .notNull()
    .references(() => wallets.id),
  thresholdLamports: bigint("threshold_lamports", { mode: "bigint" }).notNull(),
  splits: jsonb("splits").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Executed (or proposed) sweeps — claim→swap→split bundles, skim itemized. */
export const sweeps = pgTable("sweeps", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id")
    .notNull()
    .references(() => wallets.id),
  policyId: integer("policy_id").references(() => policies.id),
  status: text("status", {
    enum: ["proposed", "signed", "confirmed", "failed", "expired"],
  }).notNull(),
  claimedLamports: bigint("claimed_lamports", { mode: "bigint" }).notNull(),
  skimLamports: bigint("skim_lamports", { mode: "bigint" }).notNull(),
  txSignature: text("tx_signature"),
  proposedAt: timestamp("proposed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

/** Rolling adapter health — platform API churn is the #1 technical risk (PRD §8). */
export const adapterHealth = pgTable("adapter_health", {
  id: serial("id").primaryKey(),
  platform: text("platform", { enum: ["bags", "pumpfun"] }).notNull(),
  healthy: boolean("healthy").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  error: text("error"),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
