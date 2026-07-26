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
   * Build the unsigned claim instruction(s) for the wallet's claimable fees.
   * Returns base64-encoded serialized instructions; composed downstream into
   * the propose-then-sign bundle (claim + swap + split + itemized skim).
   * Week 2 — adapters may throw NotImplemented until then.
   */
  buildClaimInstructions(wallet: string, mints: string[]): Promise<string[]>;

  /** Cheap liveness probe against the platform surface this adapter depends on. */
  healthCheck(): Promise<AdapterHealth>;
}

/** Wraps every platform failure so callers never see platform-shaped errors. */
export class AdapterError extends Error {
  constructor(
    readonly platform: Platform,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`[${platform}] ${message}`);
    this.name = "AdapterError";
  }
}
