import type { AdapterHealth, TokenFeeState } from "@feesweep/core";
import { AdapterError, type LaunchpadAdapter } from "./adapter";
import { mapWithConcurrency } from "./util";

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
  quoteMint?: string;
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

export interface BagsFeedItem {
  name: string;
  symbol: string;
  tokenMint: string;
  status: string;
}

export interface BagsCreator {
  wallet?: string;
  isCreator?: boolean;
  royaltyBps?: number;
  username?: string;
  twitterUsername?: string;
}

/**
 * Bags Public API v2 adapter. Read side: claimable royalty positions,
 * lifetime earned (claimed + claimable), and partner-config fee state.
 * Claim side: serialized claim transactions via /claim-txs/v3.
 *
 * Rate limit is 1,000 req/hr per key — scanWallet costs 2 + one claim-stats
 * call per token, so the aggregate metrics job must budget accordingly.
 */
export interface BagsAdapterOptions {
  /**
   * Lite mode for aggregate/metrics scans: skip the per-token claim-stats
   * calls and the partner-stats call, so a wallet scan costs exactly one API
   * request. Claimable alone is the headline number; totalEarned degrades to
   * null. (Rate budget: 1,000 req/hr — lessons 2026-07-26 #3.)
   */
  lite?: boolean;
}

export class BagsAdapter implements LaunchpadAdapter {
  readonly platform = "bags" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly options: BagsAdapterOptions = {},
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE_URL}${path}`, {
        signal: AbortSignal.timeout(15_000),
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
      // claim-stats is per-token and lists a wallet only once it has claimed:
      // absence on a successful response means zero claimed, so earned =
      // claimable. Only a failed request degrades totalEarned to null — never
      // the whole scan.
      let totalEarned: bigint | null = null;
      if (!this.options.lite) {
        try {
          const stats = await this.request<ClaimStat[]>(
            `/token-launch/claim-stats?tokenMint=${encodeURIComponent(pos.baseMint)}`,
          );
          const mine = stats.find((s) => s.wallet === wallet);
          totalEarned = BigInt(mine?.totalClaimed ?? 0) + claimable;
        } catch {
          totalEarned = null;
        }
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
        quoteMint: pos.quoteMint ?? null,
        // Accrual rate is derived from successive scan snapshots (scans
        // table), not from any platform API.
        accrualPerDay: null,
      };
      return token;
    });

    if (!this.options.lite) {
      const partner = await this.partnerFeeState(wallet);
      if (partner) tokens.push(partner);
    }

    return tokens;
  }

  /** Recent/active token launches — used by the metrics job for discovery. */
  async launchFeed(): Promise<BagsFeedItem[]> {
    return this.request<BagsFeedItem[]>("/token-launch/feed");
  }

  /**
   * Wallets entitled to a token's fees. The deployer and the fee claimers are
   * usually different wallets (lessons 2026-07-26 #7) — callers who want fee
   * holders must filter on royaltyBps > 0, not isCreator.
   */
  async tokenCreators(tokenMint: string): Promise<BagsCreator[]> {
    return this.request<BagsCreator[]>(
      `/token-launch/creator/v3?tokenMint=${encodeURIComponent(tokenMint)}`,
    );
  }

  /**
   * Wallet-scoped partner-config fees; null when the wallet has no config.
   * The live API answers 500 (not the documented 404) for wallets without a
   * partner config, so any failure here degrades to "no partner row" rather
   * than sinking the creator-position scan.
   */
  private async partnerFeeState(wallet: string): Promise<TokenFeeState | null> {
    let stats: PartnerStats;
    try {
      stats = await this.request<PartnerStats>(
        `/fee-share/partner-config/stats?partner=${encodeURIComponent(wallet)}`,
      );
    } catch {
      return null;
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
      // Partner stats carry no denomination; Bags partner fees settle in SOL
      // today, but display-layer should treat null as "assume SOL".
      quoteMint: null,
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
