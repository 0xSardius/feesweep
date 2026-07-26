# 2026-07-26 — Pump.fun adapter build lessons

## 1. PumpPortal has no read side — direct program reads are the primary, not the fallback
- **Lesson:** PumpPortal's creator-fee API only *builds claim txs* (`trade-local`, action `collectCreatorFee`); there is no endpoint for claimable balances. The PRD's "fallback: direct program reads" is actually the only read path.
- **Applied:** adapter reads vault state via Helius RPC (2 calls + 1 cached rent call per scan); PumpPortal is used solely for claim-tx composition. `trade-local` needs no API key and returns raw serialized tx **bytes** (not JSON, not base58) — we base58-encode to match the adapter contract.

## 2. Pump fees are per-creator aggregates, not per-token
- **Lesson:** One vault per creator across ALL their tokens on each program: bonding-curve fees accrue as native SOL in PDA `["creator-vault", creator]` under `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`; migrated (PumpSwap canonical pool) fees accrue as WSOL in the ATA of authority PDA `["creator_vault", creator]` under `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`.
- **Trap:** hyphen in the pump seed, underscore in the AMM seed.
- **Applied:** adapter emits at most two aggregate rows (bonding + PumpSwap) using vault PDAs as row identity. Scanner UI must not pretend these are tokens; per-token attribution would need event indexing.

## 3. Claimable = vault balance − rent-exempt minimum; drained vaults vanish
- **Lesson:** the bonding vault must retain rent (890,880 lamports for 0-data). A fully-claimed vault is deallocated (`getAccountInfo` → null), so "account missing" = zero claimable, not an error. Live check: two active creators had no vault at all (recently claimed), a third had 3.77 SOL sitting unclaimed.
- **Validation method that worked:** derive PDA → check account existence/owner on-chain before trusting scan output. Positive control (a wallet with a live vault) is essential — zero-rows on two wallets looked like a bug but was truth.

## 4. Lifetime earned needs event history (open)
- **Open:** `totalEarned` is null for pumpfun rows. Options: Helius enhanced-tx parsing of past `collectCreatorFee`/`collect_coin_creator_fee` events, or accept null and show "since first scan" accrual from our snapshots. Decide when building the scanner UI.

## 5. PumpSwap claim path not yet composable (open)
- **Open:** PumpPortal `collectCreatorFee` covers the bonding-curve vault (pool `pump`; `meteora-dbc` variant needs `mint`). No documented PumpPortal path for PumpSwap `collect_coin_creator_fee` — week-2 composer likely builds that instruction directly from the pump_amm IDL (in pump-fun/pump-public-docs `idl/`).
