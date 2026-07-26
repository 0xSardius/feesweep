# Adapter roadmap

How we decide which platform adapters to build, and in what order. The adapter
layer is the moat (lessons 2026-07-21 §3): nobody else has an incentive to build
cross-platform coverage. Every adapter is one isolated `LaunchpadAdapter` module —
no core changes to add a platform.

## Prioritization rule

**Claim friction × fee volume.** A platform earns an adapter when real creator
fees accrue there AND claiming/routing them is annoying (clunky UX, expiring
rewards, no post-claim tooling). One-click platforms (Pump.fun) are worth
covering for aggregation completeness, but high-friction platforms are where the
pitch is strongest.

## Tiers

| Tier | Platforms | Trigger |
|---|---|---|
| **MVP (now)** | Bags, Pump.fun | PRD §5 |
| **Phase 2** | LetsBonk (~75% of new launches), Jupiter Studio | Kill-switch passed + scanner→paid conversion proven |
| **Phase 2.5** | Raydium LaunchLab, Meteora DBC/DAMM fee positions, Believe, Moonshot, time.fun | Volume justifies upkeep; Meteora is cheap after Bags (same underlying infra) |
| **Phase 3** | NFT royalties (Tensor, Magic Eden, Metaplex), creator LP fees, staking rewards | Same motion, new fee types — needs its own validation |
| **Phase 3+** | Multichain (Zora/Base creator rewards, BSC pump-clones) | Breaks Solana-only stack — separate decision |

## Cautions

1. **Every adapter is a permanent maintenance liability.** Claim mechanics churn
   silently (#1 technical risk); monitoring cost scales linearly with adapter
   count. Add when volume justifies upkeep, never for logo collection.
2. **Kill-switch first.** Prove conversion with two platforms before spending a
   week on adapter #3. Once conversion is proven, each adapter is pure leverage:
   same policy engine, same billing, more SOL through the skim.
3. **Turn expansion into demand data:** the scanner's platform list shows a
   "more coming — request yours" slot. Build whichever platform users actually
   ask for, in observed order.
