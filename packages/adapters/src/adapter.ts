import type {
  AdapterHealth,
  Platform,
  TokenFeeState,
} from "@feesweep/core";

/**
 * One launchpad integration. Adapters are the only code allowed to talk to
 * platform APIs/programs (PRD §8: isolation is the moat and the top risk
 * mitigation). Everything they return is normalized to core types.
 */
export interface LaunchpadAdapter {
  readonly platform: Platform;

  /**
   * Enumerate creator-fee state for every token `wallet` created on this
   * platform. Must throw AdapterError (never platform-shaped errors) so the
   * scanner can degrade per-platform instead of failing the whole scan.
   */
  scanWallet(wallet: string): Promise<TokenFeeState[]>;

  /**
   * Build the unsigned claim transaction(s) for the wallet's claimable fees.
   * Platforms return whole serialized transactions (base58), not loose
   * instructions — the week-2 bundle composer decomposes/sequences these into
   * the propose-then-sign flow (claim + swap + split + itemized skim).
   */
  buildClaimTransactions(wallet: string, mints: string[]): Promise<string[]>;

  /** Cheap liveness probe against the platform surface this adapter depends on. */
  healthCheck(): Promise<AdapterHealth>;
}

/** Wraps every platform failure so callers never see platform-shaped errors. */
export class AdapterError extends Error {
  readonly platform: Platform;
  /** HTTP status when the failure came from an API response. */
  readonly status?: number;

  constructor(
    platform: Platform,
    message: string,
    opts?: { cause?: unknown; status?: number },
  ) {
    super(`[${platform}] ${message}`, { cause: opts?.cause });
    this.name = "AdapterError";
    this.platform = platform;
    this.status = opts?.status;
  }
}
