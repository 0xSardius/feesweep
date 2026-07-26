import { describe, expect, it } from "vitest";
import { AdapterError } from "./adapter.js";
import { BagsAdapter } from "./bags.js";
import { scanAllPlatforms } from "./scan.js";

const WALLET = "CreatorWallet1111111111111111111111111111111";
const MINT_A = "MintAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MINT_B = "MintBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

type Handler = (url: string, init?: RequestInit) => unknown;

/** Mock fetch: route by substring, return Bags envelopes. */
function mockFetch(routes: Record<string, Handler>): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    for (const [fragment, handler] of Object.entries(routes)) {
      if (url.includes(fragment)) {
        const result = handler(url, init);
        if (result instanceof Response) return result;
        return new Response(JSON.stringify({ success: true, response: result }), {
          status: 200,
        });
      }
    }
    return new Response(JSON.stringify({ success: false, error: "no route" }), {
      status: 404,
    });
  }) as typeof fetch;
}

describe("BagsAdapter.scanWallet", () => {
  it("normalizes claimable positions and lifetime earned", async () => {
    const adapter = new BagsAdapter(
      "test-key",
      mockFetch({
        "claimable-positions": () => [
          {
            baseMint: MINT_A,
            totalClaimableLamportsUserShare: 1_500_000_000,
            isMigrated: true,
            isCustomFeeVault: false,
            userBps: 9000,
          },
        ],
        "claim-stats": () => [
          { wallet: WALLET, totalClaimed: "2500000000", isCreator: true },
          { wallet: "SomeoneElse", totalClaimed: "99", isCreator: false },
        ],
        "partner-config/stats": () =>
          new Response(JSON.stringify({ success: false, error: "not found" }), {
            status: 404,
          }),
      }),
    );

    const tokens = await adapter.scanWallet(WALLET);
    expect(tokens).toHaveLength(1);
    const t = tokens[0]!;
    expect(t.platform).toBe("bags");
    expect(t.source).toBe("creator");
    expect(t.mint).toBe(MINT_A);
    expect(t.claimable).toBe(1_500_000_000n);
    expect(t.totalEarned).toBe(4_000_000_000n); // claimed 2.5 + claimable 1.5
  });

  it("degrades totalEarned to null when claim-stats fails, keeps claimable", async () => {
    const adapter = new BagsAdapter(
      "test-key",
      mockFetch({
        "claimable-positions": () => [
          {
            baseMint: MINT_B,
            totalClaimableLamportsUserShare: 42,
            isMigrated: false,
            isCustomFeeVault: false,
          },
        ],
        "claim-stats": () => new Response("boom", { status: 500 }),
        "partner-config/stats": () =>
          new Response(JSON.stringify({ success: false, error: "not found" }), {
            status: 404,
          }),
      }),
    );

    const tokens = await adapter.scanWallet(WALLET);
    expect(tokens[0]!.claimable).toBe(42n);
    expect(tokens[0]!.totalEarned).toBeNull();
  });

  it("includes partner-config fees as a partner-source entry", async () => {
    const adapter = new BagsAdapter(
      "test-key",
      mockFetch({
        "claimable-positions": () => [],
        "partner-config/stats": () => ({
          claimedFees: "1000000000",
          unclaimedFees: "250000000",
        }),
      }),
    );

    const tokens = await adapter.scanWallet(WALLET);
    expect(tokens).toHaveLength(1);
    const p = tokens[0]!;
    expect(p.source).toBe("partner");
    expect(p.mint).toBe(WALLET);
    expect(p.claimable).toBe(250_000_000n);
    expect(p.totalEarned).toBe(1_250_000_000n);
  });

  it("omits partner entry when config exists but has zero fees", async () => {
    const adapter = new BagsAdapter(
      "test-key",
      mockFetch({
        "claimable-positions": () => [],
        "partner-config/stats": () => ({ claimedFees: "0", unclaimedFees: "0" }),
      }),
    );
    expect(await adapter.scanWallet(WALLET)).toHaveLength(0);
  });

  it("wraps HTTP failures in AdapterError, never platform-shaped errors", async () => {
    const adapter = new BagsAdapter(
      "test-key",
      mockFetch({ "claimable-positions": () => new Response("nope", { status: 429 }) }),
    );
    const err = await adapter.scanWallet(WALLET).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).platform).toBe("bags");
    expect((err as AdapterError).status).toBe(429);
  });
});

describe("BagsAdapter.buildClaimTransactions", () => {
  it("collects serialized txs across mints (v3 `tx` field)", async () => {
    const adapter = new BagsAdapter(
      "test-key",
      mockFetch({
        "claim-txs/v3": (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { tokenMint: string };
          return [{ tx: `tx-for-${body.tokenMint}` }];
        },
      }),
    );
    const txs = await adapter.buildClaimTransactions(WALLET, [MINT_A, MINT_B]);
    expect(txs).toEqual([`tx-for-${MINT_A}`, `tx-for-${MINT_B}`]);
  });
});

describe("BagsAdapter.healthCheck", () => {
  it("reports healthy with latency on success", async () => {
    const adapter = new BagsAdapter("test-key", mockFetch({ feed: () => [] }));
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.platform).toBe("bags");
    expect(health.error).toBeNull();
  });

  it("reports unhealthy with the error message on failure", async () => {
    const adapter = new BagsAdapter(
      "test-key",
      mockFetch({ feed: () => new Response("down", { status: 503 }) }),
    );
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.error).toContain("503");
  });
});

describe("scanAllPlatforms degradation", () => {
  it("a dead adapter lands in failedPlatforms without sinking the scan", async () => {
    const dead = new BagsAdapter(
      "test-key",
      mockFetch({ "claimable-positions": () => new Response("down", { status: 503 }) }),
    );
    const result = await scanAllPlatforms([dead], WALLET);
    expect(result.tokens).toHaveLength(0);
    expect(result.failedPlatforms).toEqual(["bags"]);
  });
});
