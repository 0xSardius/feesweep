import type { AdapterHealth, TokenFeeState } from "@feesweep/core";
import { AdapterError, type LaunchpadAdapter } from "./adapter.js";

const BASE_URL = "https://public-api-v2.bags.fm/api/v1";

/** Bags wraps every payload as { success, response } (errors use `error`). */
interface BagsEnvelope<T> {
  success: boolean;
  response?: T;
  error?: string;
}

interface ClaimablePosition {
  baseMint: string;
  totalClaimableLamportsUserShare: number;
  isMigrated: boolean;
  isCustomFeeVault: boolean;
  userBps?: number;
}

interface ClaimStat {
  wallet?: string;
  totalClaimed: string;
  isCreator?: boolean;
  royaltyBps?: number;
}

interface PartnerStats {
  claimedFees: string;
  unclaimedFees: string;
}

/**
 * Bags Public API v2 adapter. Read side: claimable royalty positions,
 * lifetime earned (claimed + claimable), and partner-config fee state.
 * Claim side: serialized claim transactions via /claim-txs/v3.
 *
 * Rate limit is 1,000 req/hr per key — scanWallet costs 2 + one claim-stats
 * call per token, so the aggregate metrics job must budget accordingly.
 */
export class BagsAdapter implements LaunchpadAdapter {
  readonly platform = "bags" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
    } catch (err) {
      throw new AdapterError("bags", `network failure on ${path}`, {
        cause: err,
      });
    }
    if (!res.ok) {
      throw new AdapterError("bags", `HTTP ${res.status} on ${path}`, {
        status: res.status,
      });
    }
    const body = (await res.json()) as BagsEnvelope<T>;
    if (!body.success) {
      throw new AdapterError("bags", body.error ?? `API error on ${path}`);
    }
    return body.response as T;
  }

  async scanWallet(wallet: string): Promise<TokenFeeState[]> {
    const positions = await this.request<ClaimablePosition[]>(
      `/token-launch/claimable-positions?wallet=${encodeURIComponent(wallet)}`,
    );

    const tokens = await mapWithConcurrency(positions, 4, async (pos) => {
      const claimable = BigInt(Math.trunc(pos.totalClaimableLamportsUserShare));
      // Lifetime earned for THIS wallet = its past claims + claimable now.
      // claim-stats is per-token; a miss degrades totalEarned to null, never
      // the whole scan.
      let totalEarned: bigint | null = null;
      try {
        const stats = await this.request<ClaimStat[]>(
          `/token-launch/claim-stats?tokenMint=${encodeURIComponent(pos.baseMint)}`,
        );
        const mine = stats.find((s) => s.wallet === wallet);
        if (mine) totalEarned = BigInt(mine.totalClaimed) + claimable;
      } catch {
        totalEarned = null;
      }

      const token: TokenFeeState = {
        platform: "bags",
        source: "creator",
        mint: pos.baseMint,
        // Metadata enrichment (name/symbol/image) happens in a shared layer
        // via Helius DAS — the Bags positions endpoint doesn't carry it.
        name: null,
        symbol: null,
        imageUrl: null,
        totalEarned,
        claimable,
        // Accrual rate is derived from successive scan snapshots (scans
        // table), not from any platform API.
        accrualPerDay: null,
      };
      return token;
    });

    const partner = await this.partnerFeeState(wallet);
    if (partner) tokens.push(partner);

    return tokens;
  }

  /** Wallet-scoped partner-config fees; null when the wallet has no config. */
  private async partnerFeeState(wallet: string): Promise<TokenFeeState | null> {
    let stats: PartnerStats;
    try {
      stats = await this.request<PartnerStats>(
        `/fee-share/partner-config/stats?partner=${encodeURIComponent(wallet)}`,
      );
    } catch (err) {
      if (err instanceof AdapterError && err.status === 404) return null;
      throw err;
    }
    const claimable = BigInt(stats.unclaimedFees);
    const claimed = BigInt(stats.claimedFees);
    if (claimable === 0n && claimed === 0n) return null;
    return {
      platform: "bags",
      source: "partner",
      mint: wallet,
      name: "Bags partner fees",
      symbol: null,
      imageUrl: null,
      totalEarned: claimed + claimable,
      claimable,
      accrualPerDay: null,
    };
  }

  async buildClaimTransactions(
    wallet: string,
    mints: string[],
  ): Promise<string[]> {
    const all: string[] = [];
    for (const mint of mints) {
      // v3 responds with `tx` (not `transaction`) — base58 serialized.
      const txs = await this.request<Array<{ tx: string }>>(
        "/token-launch/claim-txs/v3",
        {
          method: "POST",
          body: JSON.stringify({ feeClaimer: wallet, tokenMint: mint }),
        },
      );
      all.push(...txs.map((t) => t.tx));
    }
    return all;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const started = Date.now();
    try {
      await this.request<unknown[]>("/token-launch/feed");
      return {
        platform: "bags",
        healthy: true,
        checkedAt: new Date(),
        latencyMs: Date.now() - started,
        error: null,
      };
    } catch (err) {
      return {
        platform: "bags",
        healthy: false,
        checkedAt: new Date(),
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
