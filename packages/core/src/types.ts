/** Launchpad platforms FeeSweep can scan. MVP: bags + pumpfun (PRD §5). */
export type Platform = "bags" | "pumpfun";

/** Amounts are lamports as bigint end-to-end; convert to SOL only at the UI edge. */
export type Lamports = bigint;

/** Fee state for one token the wallet created on one platform. */
export interface TokenFeeState {
  platform: Platform;
  /**
   * Where the fees come from: token creator royalties, or a platform-level
   * partner/referral config (Bags partner configs are wallet-scoped, not
   * per-token — those entries use the wallet address as `mint`).
   */
  source: "creator" | "partner";
  /** Token mint address (base58); partner entries carry the wallet address. */
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  /** Lifetime creator fees earned (claimed + unclaimed). Null when the platform can't expose it. */
  totalEarned: Lamports | null;
  /** Claimable right now. */
  claimable: Lamports;
  /** Estimated accrual rate in lamports/day over the lookback window, null if unknown. */
  accrualPerDay: Lamports | null;
}

/** One wallet's cross-platform scan result. */
export interface ScanResult {
  wallet: string;
  scannedAt: Date;
  tokens: TokenFeeState[];
  /** Platforms that failed to scan (adapter unhealthy) — shown, never silently dropped. */
  failedPlatforms: Platform[];
}

export interface AdapterHealth {
  platform: Platform;
  healthy: boolean;
  checkedAt: Date;
  latencyMs: number;
  /** Human-readable failure detail when unhealthy. */
  error: string | null;
}
