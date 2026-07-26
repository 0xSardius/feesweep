/**
 * Live smoke test against the real Bags API. Needs BAGS_API_KEY in env.
 *   pnpm --filter @feesweep/adapters smoke:bags <creator-wallet>
 */
import { BagsAdapter } from "../src/bags.js";

const wallet = process.argv[2];
const apiKey = process.env.BAGS_API_KEY;
if (!apiKey) throw new Error("BAGS_API_KEY not set (add it to .env — never commit)");
if (!wallet) throw new Error("usage: smoke:bags <creator-wallet>");

const adapter = new BagsAdapter(apiKey);

const health = await adapter.healthCheck();
console.log("health:", health);

const tokens = await adapter.scanWallet(wallet);
console.log(`\n${tokens.length} fee position(s) for ${wallet}:`);
for (const t of tokens) {
  console.log(
    `  [${t.source}] ${t.mint}  claimable=${t.claimable} lamports  earned=${t.totalEarned ?? "unknown"}`,
  );
}
const total = tokens.reduce((sum, t) => sum + t.claimable, 0n);
console.log(`\ntotal claimable: ${total} lamports (${Number(total) / 1e9} SOL)`);
