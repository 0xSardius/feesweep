import { describe, expect, it } from "vitest";
import type { TokenFeeState } from "@feesweep/core";
import { enrichTokenMetadata } from "./metadata";

const row = (overrides: Partial<TokenFeeState>): TokenFeeState => ({
  platform: "bags",
  source: "creator",
  mint: "Mint1111111111111111111111111111111111111111",
  name: null,
  symbol: null,
  imageUrl: null,
  totalEarned: null,
  claimable: 100n,
  quoteMint: null,
  accrualPerDay: null,
  ...overrides,
});

function dasFetch(
  result: unknown,
  captured?: { ids?: string[] },
): typeof fetch {
  return (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      method: string;
      params: { ids: string[] };
    };
    if (captured) captured.ids = body.params.ids;
    expect(body.method).toBe("getAssetBatch");
    return new Response(JSON.stringify({ result }), { status: 200 });
  }) as typeof fetch;
}

describe("enrichTokenMetadata", () => {
  it("fills name/symbol/image for null-named rows only, skips pre-named rows", async () => {
    const captured: { ids?: string[] } = {};
    const tokens = [
      row({ mint: "MintA" }),
      row({
        mint: "VaultPda",
        name: "Pump.fun creator fees",
        platform: "pumpfun",
      }),
    ];
    const enriched = await enrichTokenMetadata(
      "https://rpc.test",
      tokens,
      dasFetch(
        [
          {
            id: "MintA",
            content: {
              metadata: { name: "Cool Token", symbol: "COOL" },
              links: { image: "https://img.test/cool.png" },
            },
          },
        ],
        captured,
      ),
    );
    expect(captured.ids).toEqual(["MintA"]); // pre-named row not looked up
    expect(enriched[0]!.name).toBe("Cool Token");
    expect(enriched[0]!.symbol).toBe("COOL");
    expect(enriched[0]!.imageUrl).toBe("https://img.test/cool.png");
    expect(enriched[1]!.name).toBe("Pump.fun creator fees");
  });

  it("falls back to file uri when links.image missing, leaves unknown mints untouched", async () => {
    const enriched = await enrichTokenMetadata(
      "https://rpc.test",
      [row({ mint: "MintA" }), row({ mint: "MintB" })],
      dasFetch([
        {
          id: "MintA",
          content: {
            metadata: { name: "T" },
            files: [{ uri: "https://img.test/file.png" }],
          },
        },
        null, // DAS returns null for unknown ids
      ]),
    );
    expect(enriched[0]!.imageUrl).toBe("https://img.test/file.png");
    expect(enriched[1]!.name).toBeNull();
  });

  it("degrades to un-enriched rows on DAS failure", async () => {
    const tokens = [row({ mint: "MintA" })];
    const enriched = await enrichTokenMetadata(
      "https://rpc.test",
      tokens,
      (async () => new Response("down", { status: 503 })) as typeof fetch,
    );
    expect(enriched).toEqual(tokens);
  });

  it("makes no request when every row is pre-named", async () => {
    let called = false;
    const enriched = await enrichTokenMetadata(
      "https://rpc.test",
      [row({ name: "Bags partner fees", source: "partner" })],
      (async () => {
        called = true;
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    );
    expect(called).toBe(false);
    expect(enriched[0]!.name).toBe("Bags partner fees");
  });
});
