import {
  BagsAdapter,
  PumpfunAdapter,
  enrichTokenMetadata,
  scanAllPlatforms,
  type LaunchpadAdapter,
} from "@feesweep/adapters";
import { db, schema, type ScanResult, type TokenFeeState } from "@feesweep/core";

/** TokenFeeState with lamport bigints as decimal strings — the wire/DB shape. */
export interface TokenFeeStateWire
  extends Omit<TokenFeeState, "totalEarned" | "claimable" | "accrualPerDay"> {
  totalEarned: string | null;
  claimable: string;
  accrualPerDay: string | null;
}

export interface ScanResponse {
  wallet: string;
  scannedAt: string;
  tokens: TokenFeeStateWire[];
  failedPlatforms: string[];
  totals: {
    claimableLamports: string;
    /** Sum over rows where the platform exposes lifetime earned; partial by design. */
    earnedLamports: string;
  };
}

function buildAdapters(): LaunchpadAdapter[] {
  const adapters: LaunchpadAdapter[] = [];
  const bagsKey = process.env.BAGS_API_KEY;
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (bagsKey) adapters.push(new BagsAdapter(bagsKey));
  if (rpcUrl) adapters.push(new PumpfunAdapter(rpcUrl));
  if (adapters.length === 0) {
    throw new Error("no adapters configured — set BAGS_API_KEY / HELIUS_RPC_URL");
  }
  return adapters;
}

function toWire(t: TokenFeeState): TokenFeeStateWire {
  return {
    ...t,
    totalEarned: t.totalEarned?.toString() ?? null,
    claimable: t.claimable.toString(),
    accrualPerDay: t.accrualPerDay?.toString() ?? null,
  };
}

export async function runScan(wallet: string): Promise<ScanResponse> {
  const result: ScanResult = await scanAllPlatforms(buildAdapters(), wallet);

  const rpcUrl = process.env.HELIUS_RPC_URL;
  const tokens = rpcUrl
    ? await enrichTokenMetadata(rpcUrl, result.tokens)
    : result.tokens;

  const claimable = tokens.reduce((sum, t) => sum + t.claimable, 0n);
  const earned = tokens.reduce((sum, t) => sum + (t.totalEarned ?? 0n), 0n);
  const wire = tokens.map(toWire);

  await persistSnapshot(result, wire, claimable);

  return {
    wallet: result.wallet,
    scannedAt: result.scannedAt.toISOString(),
    tokens: wire,
    failedPlatforms: result.failedPlatforms,
    totals: {
      claimableLamports: claimable.toString(),
      earnedLamports: earned.toString(),
    },
  };
}

/**
 * Scan snapshots feed accrual-rate estimates and the aggregate-unclaimed
 * metric, but a down DB must never break the free scanner — it's the
 * acquisition funnel.
 */
async function persistSnapshot(
  result: ScanResult,
  tokens: TokenFeeStateWire[],
  claimable: bigint,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await db().insert(schema.scans).values({
      walletAddress: result.wallet,
      scannedAt: result.scannedAt,
      tokens,
      totalClaimableLamports: claimable,
      failedPlatforms: result.failedPlatforms,
    });
  } catch (err) {
    console.error("scan snapshot persist failed:", err);
  }
}
