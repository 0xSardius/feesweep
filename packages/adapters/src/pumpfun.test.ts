import { describe, expect, it } from "vitest";
import { AdapterError } from "./adapter";
import { PumpfunAdapter } from "./pumpfun";

// Any valid base58 32-byte address works; PDAs are derived from it.
const WALLET = "2zivsB28Ma58ND9jTtXa26CkBPVsjd79aQaHpo9eKqhF";
const RENT = 890_880;

type RpcHandler = (params: unknown[]) => unknown;

/** Mock fetch speaking JSON-RPC for the Helius URL, raw bytes for PumpPortal. */
function mockRpc(
  handlers: Record<string, RpcHandler>,
  portal?: (init?: RequestInit) => Response,
): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    if (url.includes("pumpportal")) {
      if (portal) return portal(init);
      return new Response("no portal route", { status: 500 });
    }
    const req = JSON.parse(String(init?.body)) as {
      method: string;
      params: unknown[];
    };
    const handler = handlers[req.method];
    if (!handler) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32601, message: `no handler for ${req.method}` },
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: handler(req.params) }),
      { status: 200 },
    );
  }) as typeof fetch;
}

const wsolAccount = (amount: string) => ({
  account: {
    data: { parsed: { info: { tokenAmount: { amount } } } },
  },
});

describe("PumpfunAdapter.scanWallet", () => {
  it("emits bonding + AMM aggregate rows, rent excluded from vault balance", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({
        getMinimumBalanceForRentExemption: () => RENT,
        getBalance: () => ({ value: RENT + 5_000_000 }),
        getTokenAccountsByOwner: () => ({
          value: [wsolAccount("3000000"), wsolAccount("250")],
        }),
      }),
    );

    const tokens = await adapter.scanWallet(WALLET);
    expect(tokens).toHaveLength(2);
    const [bonding, amm] = tokens;
    expect(bonding!.platform).toBe("pumpfun");
    expect(bonding!.claimable).toBe(5_000_000n);
    expect(bonding!.name).toContain("Pump.fun");
    expect(amm!.claimable).toBe(3_000_250n);
    expect(amm!.name).toContain("PumpSwap");
    // Distinct deterministic row identities (vault PDAs), never the wallet.
    expect(bonding!.mint).not.toBe(amm!.mint);
    expect(bonding!.mint).not.toBe(WALLET);
  });

  it("returns no rows when the vault holds only rent and no WSOL accounts exist", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({
        getMinimumBalanceForRentExemption: () => RENT,
        getBalance: () => ({ value: RENT }),
        getTokenAccountsByOwner: () => ({ value: [] }),
      }),
    );
    expect(await adapter.scanWallet(WALLET)).toHaveLength(0);
  });

  it("treats a never-created vault (0 balance) as zero claimable", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({
        getMinimumBalanceForRentExemption: () => RENT,
        getBalance: () => ({ value: 0 }),
        getTokenAccountsByOwner: () => ({ value: [] }),
      }),
    );
    expect(await adapter.scanWallet(WALLET)).toHaveLength(0);
  });

  it("survives getMinimumBalanceForRentExemption failure via fallback constant", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({
        getBalance: () => ({ value: RENT + 42 }),
        getTokenAccountsByOwner: () => ({ value: [] }),
      }),
    );
    const tokens = await adapter.scanWallet(WALLET);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.claimable).toBe(42n);
  });

  it("wraps RPC failures in AdapterError", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      (async () => new Response("down", { status: 503 })) as typeof fetch,
    );
    const err = await adapter.scanWallet(WALLET).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).platform).toBe("pumpfun");
    expect((err as AdapterError).status).toBe(503);
  });
});

describe("PumpfunAdapter.buildClaimTransactions", () => {
  it("returns the PumpPortal local tx base58-encoded", async () => {
    const rawTx = new Uint8Array([1, 2, 3, 255, 0, 42]);
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({}, (init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(body.action).toBe("collectCreatorFee");
        expect(body.publicKey).toBe(WALLET);
        return new Response(rawTx, { status: 200 });
      }),
    );
    const txs = await adapter.buildClaimTransactions(WALLET, []);
    expect(txs).toHaveLength(1);
    // base58 round-trips the exact bytes
    const { getBase58Codec } = await import("@solana/kit");
    expect(new Uint8Array(getBase58Codec().encode(txs[0]!))).toEqual(rawTx);
  });

  it("wraps PumpPortal failures in AdapterError", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({}, () => new Response("rate limited", { status: 429 })),
    );
    const err = await adapter
      .buildClaimTransactions(WALLET, [])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).status).toBe(429);
  });
});

describe("PumpfunAdapter.healthCheck", () => {
  it("healthy when the pump program account is executable", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({ getAccountInfo: () => ({ value: { executable: true } }) }),
    );
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.platform).toBe("pumpfun");
  });

  it("unhealthy when the program is missing or RPC fails", async () => {
    const adapter = new PumpfunAdapter(
      "https://rpc.test",
      mockRpc({ getAccountInfo: () => ({ value: null }) }),
    );
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.error).toContain("pump program");
  });
});
