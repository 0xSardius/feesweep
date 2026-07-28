# Checkpoint — July 27, 2026

## Week 1 build: COMPLETE except creator interviews
- **Aggregate metrics job** (`pnpm --filter @feesweep/keeper job:aggregate`): **~2,575 SOL unclaimed across ~135 active creators** (bags 1,720 + pump 856, best per-platform runs). Kill-switch (≥1,000 SOL) PASSED 2.5x. Run at most hourly — Bags quota (lessons 2026-07-27).
- **Telegram accrual alerts**: built (keeper `start` runs the loop; /watch /unwatch /list). BLOCKED on user creating a bot via @BotFather and filling TELEGRAM_BOT_TOKEN in .env.
- **Local Postgres up** (docker compose), schema pushed, snapshots persisting.
- **Creator interviews: 0/5–10** — the only kill-switch input still missing.

## Next
1. User: BotFather token → live-test alerts end-to-end.
2. User: creator interview DMs (armed with the 2,575 SOL number).
3. Then week 2 (PRD §5): policy builder UI, propose-then-sign claim→swap→split, billing. Watch: Bags tx decompose-vs-sequence question, PumpSwap claim instruction from pump_amm IDL.

# Checkpoint — July 26, 2026 (evening)

## Scanner web app SHIPPED (local)
The full free-scanner funnel works end-to-end against mainnet at `pnpm --filter @feesweep/web dev`:
- `/` — paste-any-wallet scanner (Emerald Ape neobrutalism, loading/empty/error states, browser-verified)
- `/api/scan` — cross-platform scan + DAS metadata + snapshot persist (degrades if DB down)
- `/scan/[wallet]` — shareable result page, dynamic title, X share + copy link
- `/scan/[wallet]/opengraph-image` — live-generated brand card ("3.85 SOL sitting unclaimed"), Space fonts via Satori
- Note: workspace switched to bundler moduleResolution / extensionless imports (Turbopack requirement). Never compile packages with plain tsc-to-node; run via tsx/bundler.

## State
Week 1 build underway. Monorepo scaffolded (pnpm: `apps/web`, `packages/core`, `packages/adapters`, `services/keeper`), Emerald Ape brand applied, Drizzle schema + local Postgres compose in place.

**Both MVP adapters are built, unit-tested (20 tests), and live-verified against mainnet:**

- **Bags adapter** — claimable positions, lifetime earned, partner fees, claim txs. First live run hardened it: partner-stats 500s degrade to no-row, empty claim-stats = zero claimed, `quoteMint` plumbed through `TokenFeeState`.
- **Pump.fun adapter** — direct vault reads via Helius (bonding-curve PDA + PumpSwap WSOL vault; per-creator aggregates, not per-token), PumpPortal `trade-local` for claim txs. Live-verified against a creator with 3.79 SOL unclaimed.

Keys in `.env` (gitignored): BAGS_API_KEY, HELIUS_RPC_URL/API_KEY, PUMPPORTAL_API_KEY, DATABASE_URL, TELEGRAM_BOT_TOKEN. Smoke scripts: `pnpm --filter @feesweep/adapters smoke:bags|smoke:pumpfun <wallet>`.

## Next steps (PRD §5 week 1 remainder)
1. **Scanner web app** — wallet input → `scanAllPlatforms` → results + shareable X-optimized cards. Needs shared Helius DAS metadata enrichment layer (name/symbol/image for Bags mints; pumpfun rows are aggregates, render as such).
2. **Aggregate-unclaimed metrics job** (launch-tweet number). Bags budget: 1,000 req/hr; skip claim-stats enrichment for aggregates. Feed→creator walk must use *fee-claimer* wallets (royaltyBps>0), not deployers.
3. **Telegram read-only accrual alerts.**
4. **Creator interviews (0/5–10 so far)** — kill-switch check due end of week 1 (PRD §7).

## Open questions (tracked in lessons/)
- Non-SOL-quote Bags pools: is claimable still SOL-denominated? (need a real non-SOL pool)
- pumpfun `totalEarned`: Helius enhanced-tx event history vs. snapshot-based accrual only.
- PumpSwap claim composition (no PumpPortal path) — build from pump_amm IDL in week 2.
- Bags claim-tx decompose-vs-sequence for the propose-then-sign composer (affects skim mechanics, PRD §11).
