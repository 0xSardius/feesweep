import type { TokenFeeState } from "@feesweep/core";

/**
 * Shared token-metadata enrichment via Helius DAS `getAssetBatch` (lessons
 * 2026-07-26: fee endpoints carry no name/symbol/image; enrichment is a
 * shared layer, never per-adapter).
 *
 * The contract with adapters: rows whose `name` is null represent real token
 * mints and get a DAS lookup; rows that aren't tokens (pumpfun per-creator
 * aggregates, Bags partner entries) arrive pre-named and pass through
 * untouched. Any DAS failure degrades to the un-enriched rows — metadata is
 * cosmetic, the lamports are the product.
 */

interface DasAsset {
  id: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
    files?: Array<{ uri?: string; cdn_uri?: string }>;
  };
}

const BATCH_SIZE = 100;

export async function enrichTokenMetadata(
  rpcUrl: string,
  tokens: TokenFeeState[],
  fetchImpl: typeof fetch = fetch,
): Promise<TokenFeeState[]> {
  const mints = [...new Set(tokens.filter((t) => t.name === null).map((t) => t.mint))];
  if (mints.length === 0) return tokens;

  const assets = new Map<string, DasAsset>();
  for (let i = 0; i < mints.length; i += BATCH_SIZE) {
    const batch = mints.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "feesweep-enrich",
          method: "getAssetBatch",
          params: { ids: batch },
        }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { result?: Array<DasAsset | null> };
      for (const asset of body.result ?? []) {
        if (asset) assets.set(asset.id, asset);
      }
    } catch {
      // Degrade: this batch stays un-enriched.
    }
  }
  if (assets.size === 0) return tokens;

  return tokens.map((t) => {
    if (t.name !== null) return t;
    const asset = assets.get(t.mint);
    if (!asset) return t;
    const content = asset.content;
    return {
      ...t,
      name: content?.metadata?.name ?? null,
      symbol: content?.metadata?.symbol ?? null,
      imageUrl:
        content?.links?.image ??
        content?.files?.[0]?.cdn_uri ??
        content?.files?.[0]?.uri ??
        null,
    };
  });
}
