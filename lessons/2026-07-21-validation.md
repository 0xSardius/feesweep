# 2026-07-21 — Validation sprint lessons

## 1. Bare claiming is a weak wedge on pump.fun
- **Lesson:** Pump.fun native claiming is one-click, claim-anytime, and unclaimed fees are never forfeited. "We claim for you" alone is thin value on the biggest platform.
- **Evidence:** pump.fun's own claim flow ([X post](https://x.com/pumpdotfun/status/1921941830095995205)); fee policy confirmed in July 21 search sweep.
- **Decision changed:** Repositioned from "auto-claimer" to **creator fee command center** — free cross-platform scanner as acquisition hook; monetize the policy layer (alerts, claim→swap→split). Claiming is a feature, not the product.

## 2. Willingness-to-pay is proven by a live competitor, at 2–15%
- **Lesson:** Creators already pay a percentage cut for fee recovery — we don't need to validate the pricing model from scratch, only conversion to a recurring/automated version.
- **Evidence:** [unclaimedsol.com](https://unclaimedsol.com/) charges 2% (capped) to 15% across Pump.fun/Raydium/Meteora; live product.
- **Decision changed:** Price the sweep skim at 2–5% (undercut the recovery service, since ours is continuous not one-off) + subscription tier.

## 3. The adapter layer is both the hard part and the moat
- **Lesson:** Each launchpad stores/exposes accrued creator fees differently; enumeration and claim-building per platform is the real engineering. Nobody (including the platforms) has an incentive to build *cross-platform* coverage — that asymmetry is the defensibility.
- **Evidence:** Bags = SDK partner-config claim txns; Pump.fun = claim instruction (PumpPortal exposes an API: [pumpportal.fun/creator-fee](https://pumpportal.fun/creator-fee/)); LetsBonk/Jupiter Studio less documented → deferred to v2.
- **Decision changed:** MVP scope locked to Bags + Pump.fun adapters only; adapter isolation + monitoring designed in from day one.

## 4. The scanner is the demand test — with a kill-switch
- **Lesson:** We couldn't quantify aggregate unclaimed/idle creator fees from outside; the week-1 scanner produces that number for real wallets.
- **Evidence:** Validation gap noted in `feesweep/validation-report.html` (market-pull scored 2/3 for this reason).
- **Decision changed:** Attached condition to the GO: if scanned totals are embarrassingly small AND 5–10 creator interviews show no post-claim pain, stop before week 2 and re-rank plays #2/#3. The scanner's number is also the launch tweet.

## 5. Non-custodial is non-negotiable at MVP
- **Lesson:** Delegated signing is a hard trust ask in 2026 ($889M in Telegram-bot exploits Q3 2025; agent-exploit stigma).
- **Evidence:** Lane 2 + Lane 5 research; SEC April 2026 UI-provider no-action relief rewards signature-based flows.
- **Decision changed:** MVP is 100% propose-then-sign. Scoped delegation only later, via the audited native Subscriptions & Allowances program — never raw key custody.
