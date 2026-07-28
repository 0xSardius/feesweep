# 2026-07-27 — Aggregate metrics job lessons

## 1. The kill-switch number: PASSED
- Run 1 (fresh Bags quota, no pump retries): **2,011 SOL unclaimed / 134 wallets** — bags 1,720, pump 291 (72/90 pump scans failed on Helius 429s).
- Run 2 (pump retries fixed, Bags quota exhausted): **858 SOL / 101 wallets** — pump alone 856 (19 failures), bags collapsed to 10 discovered wallets.
- Best per-platform estimate: **~2,575 SOL across ~135 active creators**, from one shallow discovery pass. PRD §7 threshold was 1,000 SOL — cleared 2.5x.

## 2. Metrics runs eat the shared Bags hourly budget — never rerun back-to-back
- Discovery (1 + ~80 creator/v3 calls) + scans (~1/wallet lite) ≈ 130+ calls/run. Three runs in an hour → 429s on discovery, which degrade *silently* to "fewer wallets found" and a small-looking aggregate.
- **Rule:** schedule the job at most hourly; treat a sudden drop in discovered-wallet count as quota exhaustion, not a real decline. Open idea: surface Bags `X-RateLimit-Remaining` in adapter health and print it in the job summary.

## 3. Retry-with-backoff turned pump.fun failures from 72/90 into 19/91
- Helius 429s under burst are routine; 3 attempts with 400ms×attempt backoff + concurrency 3 (not 8) holds. Fetch timeouts (15s) everywhere — an earlier run sat on a hung connection.
- Helius plan headroom matters (PRD §11 flagged it): metrics + future alert polling want a paid tier or a second key.

## 4. Numbers move fast
- The same pump creator's claimable grew 3.768 → 3.821 SOL within minutes across scans. Accrual is visibly live — good for the alerts product; also means aggregate snapshots are point-in-time, not stable facts. Always timestamp the launch-tweet number.
