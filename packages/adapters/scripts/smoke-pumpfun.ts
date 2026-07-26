/**
 * Live smoke test against real pump.fun program state. Needs HELIUS_RPC_URL.
 *   pnpm --filter @feesweep/adapters smoke:pumpfun <creator-wallet>
 */
import { PumpfunAdapter } from "../src/pumpfun";

const wallet = process.argv[2];
const rpcUrl = process.env.HELIUS_RPC_URL;
if (!rpcUrl) throw new Error("HELIUS_RPC_URL not set (add it to .env — never commit)");
if (!wallet) throw new Error("usage: smoke:pumpfun <creator-wallet>");

const adapter = new PumpfunAdapter(rpcUrl);

const health = await adapter.healthCheck();
console.log("health:", health);

const tokens = await adapter.scanWallet(wallet);
console.log(`\n${tokens.length} fee position(s) for ${wallet}:`);
for (const t of tokens) {
  console.log(
    `  [${t.source}] ${t.name} (${t.mint})  claimable=${t.claimable} lamports`,
  );
}
const total = tokens.reduce((sum, t) => sum + t.claimable, 0n);
console.log(`\ntotal claimable: ${total} lamports (${Number(total) / 1e9} SOL)`);
