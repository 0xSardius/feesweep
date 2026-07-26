# 2026-07-26 — Bags adapter build lessons

## 1. Platforms hand back whole transactions, not instructions
- **Lesson:** Bags `/token-launch/claim-txs/v3` returns fully serialized base58 transactions (field `tx`, not `transaction`). We can't just splice claim instructions into our own bundle.
- **Decision changed:** `LaunchpadAdapter.buildClaimInstructions` renamed to `buildClaimTransactions`. The week-2 propose-then-sign composer must either (a) decompose returned txs into instructions and re-compose, or (b) sequence multiple signs. Resolve when building the composer — affects PRD §11 skim-mechanics question.

## 2. Lifetime earned is computable per wallet
- **Lesson:** No single "total earned" endpoint, but `claim-stats?tokenMint=` gives per-wallet `totalClaimed`, so earned = totalClaimed + claimable. Costs one extra call per token.
- **Applied:** adapter enriches every position; degrades `totalEarned` to null on failure rather than sinking the scan.

## 3. Bags rate limit shapes the aggregate metrics job
- **Lesson:** 1,000 requests/hour per key. A wallet scan costs 2 + N (tokens) calls. The launch-tweet aggregate job over top-N creator wallets must budget: e.g. ~300 wallets × ~3 calls ≈ one full hour of quota.
- **Applied:** metrics job needs batching/caching (skip claim-stats enrichment for aggregates — claimable alone is the headline number) and should run off-peak. Also: max 10 API keys per account is not a scaling lever to lean on.

## 4. Partner-config fees are wallet-scoped, not per-token
- **Lesson:** `/fee-share/partner-config/stats` returns claimed/unclaimed per wallet with no token breakdown; 404 means "no partner config" (not an error).
- **Applied:** `TokenFeeState` gained `source: "creator" | "partner"`; partner entries use the wallet address as identifier. Scanner UI should render them as their own row, not fake tokens.

## 5. No token metadata on fee endpoints
- **Lesson:** `claimable-positions` carries no name/symbol/image. Metadata enrichment belongs in a shared layer (Helius DAS `getAsset`), not per-adapter.
- **Open:** confirm whether claimable lamports are always SOL-denominated for v2 pools with non-SOL `quoteMint` — check with a real wallet once BAGS_API_KEY is set.
