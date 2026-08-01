# FeeSweep — Product Requirements Document

**Version:** 1.1 · Aug 1, 2026 (v1.0 July 21; v1.1: skim-only MVP — subscriptions moved to phase 2, week-2 billing build dropped)
**Status:** Approved for build (validated GO 13/15, conf 0.75 — see `validation-report.html`)
**Owner:** solo build, 2-week MVP
**Positioning:** The creator fee command center for Solana launchpads. *Never brand as "AI agent."*

---

## 1. Problem

Solana token creators earn perpetual fees across an increasingly fragmented launchpad landscape (Bags 1% royalties, Pump.fun creator rewards, LetsBonk, Jupiter Studio). Since the July 2026 share flip (Pump.fun 93%→15% of new launches; LetsBonk 75%), creators are multi-homed — but their fee state is scattered:

- **No unified view** of what they've earned or what's sitting unclaimed across platforms.
- **No accrual awareness** — fees build silently; creators check manually or forget entirely (a recovery service, Unclaimed SOL, profitably charges 2–15% just to find forgotten fees).
- **Nothing happens after the claim** — swapping to stables, funding a marketing wallet, feeding a holder-dividend pool are all manual, per-platform chores. No treasury policy exists at "solo creator with a token" scale.

Claiming itself is *not* the problem on every platform (pump.fun is one-click) — fragmentation, awareness, and post-claim policy are.

## 2. Product

**Free tier — the Scanner (acquisition hook):** paste/connect any wallet → instant cross-platform report: total earned, claimable now, accrual rate, per-token breakdown, across Bags + Pump.fun (MVP). Shareable result card ("this wallet has X SOL sitting unclaimed").

**Paid tier — the Autopilot (the product):** a policy the creator sets once:
> "When claimable fees exceed 0.5 SOL: claim everything, swap 60% to USDC into my treasury wallet, keep 25% in SOL for the marketing wallet, route 15% to the holder-dividend pool. Alert me on Telegram."

FeeSweep watches accrual, and when the policy triggers, delivers a **pre-built transaction bundle the creator signs in one click** (propose-then-sign; we never hold keys or funds). Telegram alerts on accrual milestones, claims executed, and anomalies.

### Non-negotiable product principles
1. **Non-custodial, propose-then-sign only** in MVP. Scoped delegation (auto-execute within limits) is v2, via the native Subscriptions & Allowances program — never key custody.
2. **Outcome-first branding.** "Claim every fee you're owed." The word "agent" appears nowhere user-facing.
3. **The skim is disclosed in-product**, itemized on every sweep.

## 3. Users

| Persona | Description | Job-to-be-done | Pays? |
|---|---|---|---|
| **Multi-launch creator** (primary) | Has launched 3+ tokens, often across platforms; fees accrue on several | "Show me everything I'm owed; move it where I want without babysitting" | Yes — sweep skim |
| **Bags-native creator** | Lives in the Bags ecosystem, uses fee-shares/dividends | "Automate my claim→dividend routine" | Yes — sweep skim; reached via Bags App Store |
| **Curious wallet-checker** | Anyone pasting a wallet into the free scanner | "How much is this wallet leaving on the table?" | No — top of funnel, viral loop |
| **Other agents/dashboards** (v1.5) | Bots and tools querying fee state programmatically | "Give me claimable-fee data for wallet X" | Per-call via x402 |

## 4. Revenue model

| Stream | Price | When it starts |
|---|---|---|
| Sweep skim | **3% of value claimed** per executed sweep (min 0.01 SOL, cap 1 SOL/sweep) — undercuts Unclaimed SOL's 2–15% recovery pricing while being continuous | First sweep, day one |
| x402/MCP endpoint | `GET /claimable/{wallet}` at ~$0.01/call for agents/dashboards | v1.5 (one day of work; a surface, not a strategy) |
| Autopilot subscription | Phase 2, additive — $19/mo single / $49/mo 5-wallet in USDC on native Subscriptions & Allowances, once there's something subscription-shaped (multi-wallet/team dashboards, premium alert routing); a "pro waives the skim" tier is a future lever | Phase 2 |

Pricing stance (MVP): **skim-only**. You pay only when you get paid — perfectly aligned, crypto-native (tx-fee mental model, not SaaS), and one signature from scan to paid instead of a checkout. Known trade-off, accepted: the skim is only captured on sweeps executed through FeeSweep — a creator can take a free alert and claim directly on the platform. The skim prices the *automation* (claim→swap→split in one signature); dodging it means doing that work manually, which is exactly the pain the product bets on. Users who'd dodge 3% weren't paying $19/mo either.

## 5. MVP scope (2 weeks)

### Week 1 — Scanner + demand test
- **Bags adapter:** claimable royalties + partner-config fee state via official Bags SDK.
- **Pump.fun adapter:** claimable creator rewards via PumpPortal creator-fee API (fallback: direct program-account reads).
- **Scanner web app:** wallet input (paste or connect) → earned / claimable / accrual-rate report, per-token table, shareable OG-image result card. Next.js + `@solana/kit`, wallet-standard connection.
- **Aggregate metrics job:** scan top-N creator wallets per platform → the "creators are sitting on X SOL unclaimed" number for the launch tweet.
- **Telegram bot (read-only):** link wallet → accrual alerts at thresholds.

### Week 2 — Autopilot (skim-only monetization; no billing build)
- **Policy builder UI:** threshold trigger + split rules (swap % via Jupiter Ultra, destination wallets, dividend-pool route on Bags).
- **Propose-then-sign execution:** keeper detects trigger → builds claim + swap + transfer bundle → push notification → one-click sign in wallet. Skim transfer itemized in the same bundle — this IS the monetization; no separate billing system in MVP.
- **Ops:** Helius webhooks/polling keeper, adapter health monitoring (platform API churn is the #1 technical risk), basic dashboard of sweep history.

### Explicitly out of MVP scope
- LetsBonk + Jupiter Studio adapters (v2 — less-documented claim mechanics)
- Auto-execution / scoped delegation (v2, via allowances only)
- SplitRoute (collab-launch fee splits on Bags partner configs) — phase 2 product
- Holder Club (fan subscriptions → dividend loop) — phase 2 product
- Custom on-chain programs of any kind (integration-only MVP; nothing to audit)
- Mobile app, multichain, non-creator fee types (LP fees, validator rewards)

## 6. Distribution plan (day one, not after)

1. **Bags App Store submission** the day the scanner works — it's actively recruiting builders ($1M–4M dev fund); your solenrich reputation compounds here.
2. **Launch tweet = the scanner's aggregate number** ("Solana creators are sitting on X SOL of unclaimed fees — check yours in 10 seconds"). Free scanner + shareable cards is the viral loop.
3. **5–10 creator conversations during build** (Bags Discord, X DMs) — "how do you handle your fees today?" Doubles as validation debt payoff and first-customer pipeline.
4. **X ecosystem tailwind:** X product leadership actively routing distribution to Solana consumer apps — optimize the share card for X.

## 7. Success metrics & kill-switch

| Checkpoint | Metric | Threshold |
|---|---|---|
| End of week 1 | Aggregate unclaimed SOL found by scanner across top creator wallets | Meaningful headline number (order of 1,000+ SOL across scanned set) |
| End of week 1 | Creator interviews | ≥5 done; ≥3 describe post-claim pain (manual swapping/splitting/forgetting) |
| **Kill-switch** | Both above fail | **Stop before week 2; re-rank Forecast Copilot / Gacha Edge** (per validation condition) |
| Week 3 (launch +1) | Scanner→paid conversion | ≥3 paying wallets (any stream) |
| Week 6 | Revenue | ≥$500/mo run-rate (skim; ≈ $17k/mo of fees swept at 3%) or a clear growth trend; else evaluate pivot to phase-2 wedge (SplitRoute via App Store) |

## 8. Technical architecture (integration-first — no custom programs)

```
Next.js app (scanner + policy UI + dashboard)
  └─ wallet-standard connect · @solana/kit
Keeper service (Node, cron/queue)
  ├─ Adapters: bags.ts (official SDK) · pumpfun.ts (PumpPortal API / program reads)
  ├─ Accrual detection: Helius webhooks + polling fallback
  ├─ Tx composer: claim ixs + Jupiter Ultra swap + transfer splits + skim → one bundle
  └─ Alert dispatch: Telegram Bot API
Billing: none in MVP — the in-bundle skim transfer is the revenue capture (subscriptions: phase 2)
DB: Postgres (wallets, policies, sweep history, adapter health)
v1.5: x402-gated /claimable/{wallet} endpoint (PayAI facilitator) + MCP wrapper
```

Key engineering rule: **adapters are isolated modules with health checks** — per-platform claim mechanics churning silently is the top technical risk, and the adapter layer is also the moat.

## 9. Risks (from validation, with owners in-product)

| Risk | Sev | Mitigation baked into this PRD |
|---|---|---|
| Scanner→paid conversion unproven | Med | Kill-switch metrics; alerts+autopilot as retention wedge; interviews in week 1 |
| Platform API churn / native tooling | Med | Cross-platform breadth is the hedge; adapter isolation + monitoring; Bags pays builders rather than competing |
| Trust bar for signing | Med | Propose-then-sign only; skim itemized in-bundle; no custody ever |
| Launchpad share volatility | Med | Multi-platform by design; add LetsBonk in v2 to follow volume |
| Regulatory | Low | User's own earned fees, non-custodial, disclosed fees |

## 10. Phase 2 roadmap (same customers, same infra)

1. **LetsBonk + Jupiter Studio adapters** — follow the volume.
2. **Scoped auto-execution** via Subscriptions & Allowances recurring delegation ("auto-sweep up to 5 SOL/week without asking").
3. **SplitRoute** — self-serve collab-launch fee splits on Bags partner configs (setup fee + 0.25–0.5% embedded skim as a fee earner).
4. **Holder Club** — fan subscriptions on the native billing rail feeding the holder-dividend pool.
5. **x402/MCP surface expansion** — fee-state data products for the agent economy.
6. **Autopilot subscriptions** ($19/$49 in USDC on Subscriptions & Allowances) — added only when there's a subscription-shaped surface (multi-wallet/team dashboards, premium alert routing); consider "pro waives the skim."

## 11. Open questions (resolve during build, log answers in `lessons/`)

- PumpPortal creator-fee API terms/fees at scale — worth direct program-account reads instead?
- Bags dividend-pool routing: can the MVP write into DividendsBot flow, or does v1 route to a creator-designated pool wallet?
- Skim collection mechanics: separate transfer ix in-bundle (simple, visible) — confirm wallets don't flag it.
- Scanner rate limits: Helius free tier ceilings for top-N aggregate scans — may need a paid tier from day one.

---
*Prior phases: research `docs/research/00-TOP-3-PLAYS.md` · validation `feesweep/validation-report.html` · context handoff `.superstack/idea-context.md` · lessons `feesweep/lessons/`*
