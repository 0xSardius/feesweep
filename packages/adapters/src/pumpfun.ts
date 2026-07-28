import {
  getAddressEncoder,
  getBase58Codec,
  getProgramDerivedAddress,
  type Address,
  address,
} from "@solana/kit";
import type { AdapterHealth, TokenFeeState } from "@feesweep/core";
import { AdapterError, type LaunchpadAdapter } from "./adapter";

/** Pump bonding-curve program (verified against pump-fun/pump-public-docs). */
const PUMP_PROGRAM = address("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
/** PumpSwap AMM — canonical pools for migrated tokens. */
const PUMP_AMM_PROGRAM = address("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
const WSOL_MINT = "So11111111111111111111111111111111111111112";

const PUMPPORTAL_LOCAL_URL = "https://pumpportal.fun/api/trade-local";

/**
 * Rent-exempt minimum for a 0-data system account. The creator vault PDA must
 * keep this much; only the excess is claimable. Refreshed from RPC on first
 * scan, this constant is the fallback.
 */
const RENT_EXEMPT_FALLBACK = 890_880n;

interface RpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

/**
 * Pump.fun adapter. Read side is direct program reads over Helius RPC —
 * PumpPortal exposes no claimable-balance endpoint (lessons 2026-07-26):
 *
 * - Bonding-curve fees: native SOL in one vault PDA per creator,
 *   seeds ["creator-vault", creator] (hyphen) under the pump program.
 * - PumpSwap fees (migrated tokens): WSOL in the ATA of one vault authority
 *   PDA per creator, seeds ["creator_vault", creator] (underscore) under the
 *   AMM program.
 *
 * Both vaults aggregate across every token the wallet created, so this
 * adapter emits per-source aggregate rows, not per-token rows.
 *
 * Claim side: PumpPortal local API (non-custodial — returns an unsigned
 * serialized tx). Covers the bonding-curve vault only; the PumpSwap
 * collect_coin_creator_fee path is week-2 work.
 */
/**
 * Discover active pump.fun creator wallets via the (unofficial) frontend API.
 * Metrics-job discovery only — kept in the adapter layer because this surface
 * churns. Failures return what was gathered so far, never throw.
 */
export async function discoverPumpCreators(
  limitPerSort = 50,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const sorts = ["last_trade_timestamp", "market_cap"] as const;
  const wallets = new Set<string>();
  for (const sort of sorts) {
    try {
      const res = await fetchImpl(
        `https://frontend-api-v3.pump.fun/coins?offset=0&limit=${limitPerSort}&sort=${sort}&order=DESC`,
        { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) continue;
      const coins = (await res.json()) as Array<{ creator?: string }>;
      for (const coin of coins) {
        if (coin.creator) wallets.add(coin.creator);
      }
    } catch {
      // best effort — one sort failing shouldn't kill discovery
    }
  }
  return [...wallets];
}

export class PumpfunAdapter implements LaunchpadAdapter {
  readonly platform = "pumpfun" as const;
  private rentExemptMin: bigint | null = null;

  constructor(
    private readonly rpcUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    // Helius 429s under burst load (metrics job) — back off and retry before
    // surfacing, so one throttled call doesn't fail a whole wallet scan.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(this.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        throw new AdapterError("pumpfun", `RPC network failure on ${method}`, {
          cause: err,
        });
      }
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      if (!res.ok) {
        throw new AdapterError("pumpfun", `RPC HTTP ${res.status} on ${method}`, {
          status: res.status,
        });
      }
      const body = (await res.json()) as RpcResponse<T>;
      if (body.error) {
        throw new AdapterError(
          "pumpfun",
          `RPC error on ${method}: ${body.error.message}`,
        );
      }
      return body.result as T;
    }
  }

  private async deriveVaults(wallet: string): Promise<{
    bondingVault: Address;
    ammVaultAuthority: Address;
  }> {
    const creator = getAddressEncoder().encode(address(wallet));
    const [[bondingVault], [ammVaultAuthority]] = await Promise.all([
      getProgramDerivedAddress({
        programAddress: PUMP_PROGRAM,
        seeds: ["creator-vault", creator],
      }),
      getProgramDerivedAddress({
        programAddress: PUMP_AMM_PROGRAM,
        seeds: ["creator_vault", creator],
      }),
    ]);
    return { bondingVault, ammVaultAuthority };
  }

  async scanWallet(wallet: string): Promise<TokenFeeState[]> {
    const { bondingVault, ammVaultAuthority } = await this.deriveVaults(wallet);

    if (this.rentExemptMin === null) {
      try {
        const min = await this.rpc<number>(
          "getMinimumBalanceForRentExemption",
          [0],
        );
        this.rentExemptMin = BigInt(min);
      } catch {
        this.rentExemptMin = RENT_EXEMPT_FALLBACK;
      }
    }

    const [balance, tokenAccounts] = await Promise.all([
      this.rpc<{ value: number }>("getBalance", [bondingVault]),
      this.rpc<{
        value: Array<{
          account: {
            data: {
              parsed: { info: { tokenAmount: { amount: string } } };
            };
          };
        }>;
      }>("getTokenAccountsByOwner", [
        ammVaultAuthority,
        { mint: WSOL_MINT },
        { encoding: "jsonParsed" },
      ]),
    ]);

    const vaultLamports = BigInt(balance.value);
    const bondingClaimable =
      vaultLamports > this.rentExemptMin
        ? vaultLamports - this.rentExemptMin
        : 0n;
    const ammClaimable = tokenAccounts.value.reduce(
      (sum, acc) =>
        sum + BigInt(acc.account.data.parsed.info.tokenAmount.amount),
      0n,
    );

    const tokens: TokenFeeState[] = [];
    if (bondingClaimable > 0n) {
      tokens.push({
        platform: "pumpfun",
        source: "creator",
        // One vault aggregates all of the creator's tokens — the vault PDA is
        // the row identity, there is no per-token breakdown on-chain.
        mint: bondingVault,
        name: "Pump.fun creator fees",
        symbol: null,
        imageUrl: null,
        // Lifetime earned needs historical collect-event indexing (Helius
        // enhanced txs) — phase 2 of this adapter.
        totalEarned: null,
        claimable: bondingClaimable,
        quoteMint: WSOL_MINT,
        accrualPerDay: null,
      });
    }
    if (ammClaimable > 0n) {
      tokens.push({
        platform: "pumpfun",
        source: "creator",
        mint: ammVaultAuthority,
        name: "PumpSwap creator fees (migrated tokens)",
        symbol: null,
        imageUrl: null,
        totalEarned: null,
        claimable: ammClaimable,
        quoteMint: WSOL_MINT,
        accrualPerDay: null,
      });
    }
    return tokens;
  }

  async buildClaimTransactions(
    wallet: string,
    _mints: string[],
  ): Promise<string[]> {
    // Bonding-curve fees claim all-at-once per creator; mints are irrelevant.
    let res: Response;
    try {
      res = await this.fetchImpl(PUMPPORTAL_LOCAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: wallet,
          action: "collectCreatorFee",
          priorityFee: 0.000001,
        }),
      });
    } catch (err) {
      throw new AdapterError("pumpfun", "network failure on trade-local", {
        cause: err,
      });
    }
    if (!res.ok) {
      throw new AdapterError("pumpfun", `HTTP ${res.status} on trade-local`, {
        status: res.status,
      });
    }
    // trade-local responds with the raw serialized transaction bytes.
    const bytes = new Uint8Array(await res.arrayBuffer());
    return [getBase58Codec().decode(bytes)];
  }

  async healthCheck(): Promise<AdapterHealth> {
    const started = Date.now();
    try {
      const info = await this.rpc<{ value: { executable: boolean } | null }>(
        "getAccountInfo",
        [PUMP_PROGRAM, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }],
      );
      if (!info.value?.executable) {
        throw new AdapterError("pumpfun", "pump program not found on RPC");
      }
      return {
        platform: "pumpfun",
        healthy: true,
        checkedAt: new Date(),
        latencyMs: Date.now() - started,
        error: null,
      };
    } catch (err) {
      return {
        platform: "pumpfun",
        healthy: false,
        checkedAt: new Date(),
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
