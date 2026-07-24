# Idea Context — FeeSweep

**Phase:** Idea (validated) → ready for Build
**Date:** 2026-07-21

## Idea

FeeSweep — the creator fee command center for Solana launchpads. Free cross-platform scanner (Bags, Pump.fun, LetsBonk, Jupiter Studio) showing creators what they've earned and what's sitting unclaimed; paid autopilot policy layer: accrual alerts, claim → swap-to-USDC → split (treasury/marketing/holder-dividend pool), all propose-then-sign (non-custodial).

Positioning note from validation: bare "we claim for you" is a weak wedge (pump.fun native claiming is one-click, fees never forfeited). The product is the aggregation + post-claim policy layer; the scanner is the acquisition hook.

```json
{
  "idea": "FeeSweep — cross-launchpad creator fee command center + treasury autopilot",
  "validation": {
    "demand_signals": [
      "Unclaimed SOL charges 2-15% of recovered fees today for a cruder, reactive, partial-coverage version (unclaimedsol.com) — live proof of willingness-to-pay",
      "Bags App Store + $1M-4M developer fund explicitly soliciting third-party monetizable apps; Bags partner-config API (Jan 2026) has no self-serve wrapper",
      "On-chain pattern: $40M+ paid to Bags creators; top pump.fun creator wallets $1M+ cumulative; creators multi-homed after Pump.fun 93%->15% / LetsBonk 75% share flip (July 2026)",
      "Independent teams orbiting the job: PumpPortal creator-fee claim API, Moby cashback checker, Tokenfed auto-claim PoC, Bags DividendsBot — none cross-platform, none with a policy layer"
    ],
    "risks": [
      { "category": "market", "description": "Bare claiming is easy on pump.fun natively; single-platform claim value is thin — mitigated by command-center repositioning", "severity": "medium" },
      { "category": "market", "description": "Scanner->paid autopilot conversion unproven; creators may scan and DIY", "severity": "medium" },
      { "category": "platform", "description": "Launchpad share volatility and API churn; a platform could ship native tooling (cross-platform breadth is the hedge)", "severity": "medium" },
      { "category": "trust", "description": "Delegated signing is a hard ask post-$889M bot exploits — MVP stays 100% propose-then-sign; scoped delegation later via native Subscriptions & Allowances", "severity": "medium" },
      { "category": "technical", "description": "Per-platform claimable-balance enumeration differs and can churn silently — adapter layer is both the hard part and the moat", "severity": "medium" },
      { "category": "regulatory", "description": "Low: non-custodial movement of user's own earned fees, no pooled funds", "severity": "low" }
    ],
    "go_no_go": "go",
    "confidence": 0.75,
    "score": "13/15 (founder-fit 3, mvp-speed 3, distribution 2, market-pull 2, revenue 3)",
    "integration_vs_build": "Integration-first: zero custom on-chain programs for v1. Bags SDK (claim + partner configs), Pump.fun claim via PumpPortal API or direct instruction, Jupiter Ultra for swaps, Helius webhooks for accrual detection, native Subscriptions & Allowances (audited, June 2026) for billing/later delegation. Splits = plain transfers in the propose-then-sign bundle. Advantage: fast ship, no audit cost. Tiny splitter program is a v2 option only.",
    "next_steps": [
      "Write PRD (feesweep/PRD.md) with tweaked positioning: command center / policy layer, scanner as hook",
      "Week 1: build scanner (Bags + Pump.fun adapters) — its aggregate-unclaimed-fees number doubles as the demand test and the launch tweet",
      "During build: 5-10 creator conversations (Bags Discord, X DMs): 'how do you handle your fees today', not 'would you use this'",
      "Kill-switch: if scanned unclaimed totals are tiny AND interviews show no post-claim pain, stop before week 2 and re-rank plays #2/#3",
      "Week 2: propose-then-sign claim->swap->split flows, Telegram alerts, subscription billing",
      "Defer: LetsBonk + Jupiter Studio adapters, scoped delegation via allowances, SplitRoute (collab splits), Holder Club — phase 2",
      "Distribution day one: Bags App Store submission + free-scanner X launch; funding kicker: Bags dev fund"
    ]
  }
}
```

## Prior phase

Idea sourced from ranked research synthesis: `docs/research/00-TOP-3-PLAYS.md` (Play #1 of 3). Full validation report: `feesweep/validation-report.html`. Lessons log: `feesweep/lessons/`.
