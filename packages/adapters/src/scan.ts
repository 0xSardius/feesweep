import type { ScanResult } from "@feesweep/core";
import type { LaunchpadAdapter } from "./adapter";

/**
 * Cross-platform scan: run every adapter, degrade per-platform on failure.
 * A dead platform lands in `failedPlatforms` — shown to the user, never a
 * silent zero (a wrong "0 SOL unclaimed" is worse than an honest error).
 */
export async function scanAllPlatforms(
  adapters: LaunchpadAdapter[],
  wallet: string,
): Promise<ScanResult> {
  const settled = await Promise.allSettled(
    adapters.map((a) => a.scanWallet(wallet)),
  );

  const result: ScanResult = {
    wallet,
    scannedAt: new Date(),
    tokens: [],
    failedPlatforms: [],
  };

  settled.forEach((outcome, i) => {
    const adapter = adapters[i]!;
    if (outcome.status === "fulfilled") {
      result.tokens.push(...outcome.value);
    } else {
      result.failedPlatforms.push(adapter.platform);
    }
  });

  return result;
}
