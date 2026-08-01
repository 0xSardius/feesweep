# FeeSweep

The **creator fee command center** for Solana launchpads. Free cross-platform scanner (what have you earned / what's sitting unclaimed across Bags + Pump.fun) as the acquisition hook; paid autopilot policy layer — accrual alerts, claim → swap-to-USDC → split (treasury/marketing/holder-dividend pool) — delivered as propose-then-sign transaction bundles.

**Status:** Week 1 build complete (scanner + adapters + metrics + Telegram alerts, all live-verified); kill-switch aggregate passed at ~2,575 SOL. PRD v1.1 (Aug 1, 2026: skim-only MVP — subscriptions moved to phase 2). Spec: `PRD.md`. Session state: `docs/CHECKPOINT.md`. **Read `lessons/` at the start of every session** and add entries as we learn (convention in `lessons/README.md`).

Strategy/research context lives in the sibling exploration repo: `../solana-agent-exploration` (`docs/research/`, validation report).

## Product principles (non-negotiable)

1. **Non-custodial, propose-then-sign only** in MVP. The user signs every fund movement. No key custody, ever. Scoped delegation later only via the native Subscriptions & Allowances program.
2. **Never say "agent" or "auto-claimer" user-facing.** Brand the outcome: "claim every fee you're owed." (AI-agent branding is a market headwind; claiming alone is a weak wedge — the policy layer is the product.)
3. **The 3% skim is disclosed and itemized in-bundle** on every sweep (min 0.01 SOL, cap 1 SOL/sweep).
4. **Adapters are isolated modules with health checks.** Per-platform claim-mechanics churn is the #1 technical risk; the adapter layer is also the moat.
5. **Integration-only — zero custom on-chain programs in MVP.** Nothing to audit.

## Stack

Next.js (scanner + policy UI + dashboard) · `@solana/kit` + wallet-standard connect · Node keeper service (accrual detection, tx composing, alerts) · Helius webhooks + polling fallback · Jupiter Ultra for swaps · Bags official SDK · PumpPortal creator-fee API (fallback: direct program reads) · Postgres · Telegram Bot API. (Subscriptions & Allowances USDC billing: phase 2 only.)

## MVP scope (2 weeks — PRD §5)

- **Week 1:** Bags + Pump.fun adapters, scanner web app with shareable result cards, aggregate-unclaimed metrics job (the launch-tweet number), read-only Telegram accrual alerts.
- **Week 2:** policy builder UI, propose-then-sign claim→swap→split execution (the in-bundle skim IS the monetization — no billing system), keeper ops + adapter health monitoring.
- **Out of scope:** subscriptions/billing, LetsBonk/Jupiter Studio adapters, auto-execution/delegation, SplitRoute, Holder Club, custom programs, mobile, multichain. All phase 2 (PRD §10).

## Kill-switch (PRD §7 — honor it)

End of week 1: if the scanner's aggregate-unclaimed number is tiny AND creator interviews (target 5–10) show no post-claim pain → **stop before week 2**, return to the exploration repo, re-rank plays #2/#3. Week 3: ≥3 paying wallets. Week 6: ≥$500/mo run-rate or clear growth.

## Revenue quick facts

**Skim-only MVP:** 3% sweep skim (min 0.01 SOL, cap 1 SOL/sweep; starts at first sweep) — you pay only when you get paid. $500/mo ≈ $17k/mo of fees swept. Subscriptions ($19/$49 USDC) are phase 2, additive, only when there's a subscription-shaped surface. v1.5 x402 endpoint (`/claimable/{wallet}`, ~$0.01/call) as an agent-economy surface — never the core bet.

## Distribution (day one, not after launch)

Bags App Store submission the day the scanner works ($1M–4M dev fund; solenrich reputation compounds there) · launch tweet = the scanner's aggregate number · shareable scan cards optimized for X · 5–10 creator conversations during build (Bags Discord, X DMs: "how do you handle your fees today?").

## Working rules

- Commit after every modular working feature; update `docs/CHECKPOINT.md` at session end. No Co-Authored-By lines.
- **Never print secrets** (no `cat .env`); `.env` is gitignored from the first commit. Verify keys exist without revealing values.
- Open questions from PRD §11 (PumpPortal terms, Bags dividend routing, skim tx mechanics, Helius rate limits): resolve during build, log each answer as a `lessons/` entry.
