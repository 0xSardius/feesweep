/**
 * Aggregate-unclaimed metrics job — produces the launch-tweet number and the
 * week-1 kill-switch input (PRD §5, §7): how much SOL are active creators
 * sitting on across Bags + Pump.fun right now?
 *
 * Bags budget (1,000 req/hr): discovery costs 1 + min(feed, MAX_BAGS_TOKENS)
 * calls; each wallet scan costs exactly 1 call (lite mode — no claim-stats,
 * no partner-stats). Pump.fun scans are Helius RPC (2 calls/wallet), not
 * rate-bound by Bags.
 *
 *   pnpm --filter @feesweep/keeper job:aggregate
 */
import {
  BagsAdapter,
  PumpfunAdapter,
  discoverPumpCreators,
  mapWithConcurrency,
  type LaunchpadAdapter,
} from "@feesweep/adapters";
import { db, schema, type TokenFeeState } from "@feesweep/core";

const MAX_BAGS_TOKENS = 80;
const PUMP_CREATORS_PER_SORT = 50;
const SOL = 1e9;

interface WalletTotal {
  platform: "bags" | "pumpfun";
  wallet: string;
  claimable: bigint;
  tokens: TokenFeeState[];
}

async function scanWallets(
  adapter: LaunchpadAdapter,
  wallets: string[],
  concurrency: number,
): Promise<{ totals: WalletTotal[]; failures: number }> {
  let failures = 0;
  const totals = await mapWithConcurrency(wallets, concurrency, async (wallet) => {
    try {
      const tokens = await adapter.scanWallet(wallet);
      const claimable = tokens.reduce((sum, t) => sum + t.claimable, 0n);
      return { platform: adapter.platform, wallet, claimable, tokens };
    } catch {
      failures += 1;
      return { platform: adapter.platform, wallet, claimable: 0n, tokens: [] };
    }
  });
  return { totals, failures };
}

async function discoverBagsFeeWallets(bags: BagsAdapter): Promise<string[]> {
  const feed = await bags.launchFeed();
  const tokens = [...new Map(feed.map((f) => [f.tokenMint, f])).values()].slice(
    0,
    MAX_BAGS_TOKENS,
  );
  console.log(`bags: feed has ${feed.length} launches, resolving ${tokens.length}`);

  const wallets = new Set<string>();
  await mapWithConcurrency(tokens, 4, async (token) => {
    try {
      const creators = await bags.tokenCreators(token.tokenMint);
      for (const c of creators) {
        // Fee entitlement lives with royaltyBps > 0 wallets, not the deployer.
        if (c.wallet && (c.royaltyBps ?? 0) > 0) wallets.add(c.wallet);
      }
    } catch {
      // one token failing to resolve shouldn't kill discovery
    }
  });
  return [...wallets];
}

/** Best effort: snapshots feed accrual estimates later, but a down DB never blocks the metric. */
async function persistSnapshots(totals: WalletTotal[]): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const rows = totals
    .filter((t) => t.tokens.length > 0)
    .map((t) => ({
      walletAddress: t.wallet,
      tokens: t.tokens.map((tok) => ({
        ...tok,
        totalEarned: tok.totalEarned?.toString() ?? null,
        claimable: tok.claimable.toString(),
        accrualPerDay: tok.accrualPerDay?.toString() ?? null,
      })),
      totalClaimableLamports: t.claimable,
      failedPlatforms: [],
    }));
  if (rows.length === 0) return false;
  try {
    await db().insert(schema.scans).values(rows);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`snapshot persist failed (continuing): ${msg.slice(0, 200)}`);
    return false;
  }
}

const bagsKey = process.env.BAGS_API_KEY;
const rpcUrl = process.env.HELIUS_RPC_URL;
if (!bagsKey || !rpcUrl) {
  throw new Error("BAGS_API_KEY and HELIUS_RPC_URL must be set (root .env)");
}

const startedAt = Date.now();
const bags = new BagsAdapter(bagsKey, fetch, { lite: true });
const pump = new PumpfunAdapter(rpcUrl);

const [bagsWallets, pumpWallets] = await Promise.all([
  discoverBagsFeeWallets(bags),
  discoverPumpCreators(PUMP_CREATORS_PER_SORT),
]);
console.log(
  `discovered ${bagsWallets.length} bags fee wallets, ${pumpWallets.length} pump.fun creators`,
);

const [bagsScan, pumpScan] = await Promise.all([
  scanWallets(bags, bagsWallets, 4),
  // Helius throttles bursts; modest concurrency + adapter-level backoff holds.
  scanWallets(pump, pumpWallets, 3),
]);

const all = [...bagsScan.totals, ...pumpScan.totals];
const nonzero = all
  .filter((t) => t.claimable > 0n)
  .sort((a, b) => (b.claimable > a.claimable ? 1 : -1));
const total = all.reduce((sum, t) => sum + t.claimable, 0n);
const byPlatform = {
  bags: bagsScan.totals.reduce((s, t) => s + t.claimable, 0n),
  pumpfun: pumpScan.totals.reduce((s, t) => s + t.claimable, 0n),
};

const persisted = await persistSnapshots(all);

console.log("\n================ AGGREGATE UNCLAIMED ================");
console.log(
  `TOTAL: ${(Number(total) / SOL).toFixed(2)} SOL unclaimed across ${all.length} scanned wallets (${nonzero.length} with fees)`,
);
console.log(
  `  bags:     ${(Number(byPlatform.bags) / SOL).toFixed(2)} SOL over ${bagsWallets.length} wallets (${bagsScan.failures} scan failures)`,
);
console.log(
  `  pump.fun: ${(Number(byPlatform.pumpfun) / SOL).toFixed(2)} SOL over ${pumpWallets.length} wallets (${pumpScan.failures} scan failures)`,
);
console.log("\ntop 10 wallets:");
for (const t of nonzero.slice(0, 10)) {
  console.log(
    `  ${(Number(t.claimable) / SOL).toFixed(3).padStart(10)} SOL  [${t.platform}] ${t.wallet}`,
  );
}
console.log(
  `\nsnapshots persisted: ${persisted ? "yes" : "no (DB unavailable or empty run)"}`,
);
console.log(`done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
