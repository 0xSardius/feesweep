"use client";

import { useState } from "react";
import type { ScanResponse, TokenFeeStateWire } from "@/lib/scan";
import { formatSol, formatSolExact, truncateAddress } from "@/lib/format";

type ScanState =
  | { phase: "idle" }
  | { phase: "loading"; wallet: string }
  | { phase: "error"; wallet: string; message: string }
  | { phase: "done"; result: ScanResponse };

export function Scanner() {
  const [wallet, setWallet] = useState("");
  const [state, setState] = useState<ScanState>({ phase: "idle" });

  async function scan(target: string) {
    const trimmed = target.trim();
    if (!trimmed) return;
    setState({ phase: "loading", wallet: trimmed });
    try {
      const res = await fetch(`/api/scan?wallet=${encodeURIComponent(trimmed)}`);
      const body = (await res.json()) as ScanResponse & { error?: string };
      if (!res.ok) {
        setState({
          phase: "error",
          wallet: trimmed,
          message: body.error ?? "scan failed — try again in a moment",
        });
        return;
      }
      setState({ phase: "done", result: body });
    } catch {
      setState({
        phase: "error",
        wallet: trimmed,
        message: "network error — check your connection and retry",
      });
    }
  }

  return (
    <div className="w-full">
      <form
        className="flex w-full flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void scan(wallet);
        }}
      >
        <div className="flex-1">
          <label htmlFor="wallet" className="sr-only">
            Wallet address
          </label>
          <input
            id="wallet"
            name="wallet"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="paste any wallet address"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="h-12 w-full rounded-md border-2 border-foreground bg-background px-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </div>
        <button
          type="submit"
          disabled={state.phase === "loading" || wallet.trim() === ""}
          className="h-12 shrink-0 rounded-md border-2 border-foreground bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[var(--shadow-brutal)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none disabled:opacity-60"
        >
          {state.phase === "loading" ? "scanning…" : "scan"}
        </button>
      </form>

      <div className="mt-8" aria-live="polite">
        {state.phase === "loading" && <ScanSkeleton />}
        {state.phase === "error" && (
          <ErrorCard message={state.message} onRetry={() => void scan(state.wallet)} />
        )}
        {state.phase === "done" && <ScanResults result={state.result} />}
      </div>
    </div>
  );
}

function ScanSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-36 animate-pulse rounded-md border-[3px] border-foreground bg-muted motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-md border-2 border-foreground bg-muted motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-md border-2 border-foreground bg-muted motion-reduce:animate-none" />
      <p className="text-center text-xs text-muted-foreground">
        checking Bags + Pump.fun…
      </p>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border-[3px] border-destructive bg-card p-6"
    >
      <p className="text-sm font-medium text-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border-2 border-foreground bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground shadow-[var(--shadow-brutal)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        Retry scan
      </button>
    </div>
  );
}

function ScanResults({ result }: { result: ScanResponse }) {
  const hasFees = result.tokens.length > 0;
  const showEarned = result.totals.earnedLamports !== "0";

  return (
    <div className="flex flex-col gap-4">
      {result.failedPlatforms.length > 0 && (
        <div
          role="status"
          className="rounded-md border-2 border-foreground bg-accent p-3 text-sm text-accent-foreground"
        >
          Couldn&apos;t reach {result.failedPlatforms.join(" + ")} — totals below
          exclude it. Rescan in a minute.
        </div>
      )}

      <section
        aria-label="Scan totals"
        className="rounded-md border-[3px] border-foreground bg-card p-6 shadow-[var(--shadow-brutal-lg)]"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          claimable right now ·{" "}
          <span className="font-mono">{truncateAddress(result.wallet)}</span>
        </p>
        <p
          className="mt-2 font-mono text-5xl font-bold tabular-nums tracking-tight text-primary"
          title={`${formatSolExact(result.totals.claimableLamports)} SOL`}
        >
          {formatSol(result.totals.claimableLamports)}{" "}
          <span className="text-2xl text-foreground">SOL</span>
        </p>
        {showEarned && (
          <p className="mt-3 text-sm text-muted-foreground">
            lifetime earned:{" "}
            <span className="font-mono font-bold tabular-nums text-foreground">
              {formatSol(result.totals.earnedLamports)} SOL
            </span>
          </p>
        )}
      </section>

      {hasFees ? (
        <ul className="flex flex-col gap-3">
          {result.tokens.map((t) => (
            <TokenRow key={`${t.platform}-${t.mint}`} token={t} />
          ))}
        </ul>
      ) : (
        <div className="rounded-md border-2 border-foreground bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            No creator fees found for this wallet on Bags or Pump.fun.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Launched somewhere else? LetsBonk and Jupiter Studio are coming next.
          </p>
        </div>
      )}
    </div>
  );
}

function TokenRow({ token }: { token: TokenFeeStateWire }) {
  const label = token.name ?? truncateAddress(token.mint);
  return (
    <li className="flex items-center gap-4 rounded-md border-2 border-foreground bg-card p-4 shadow-[var(--shadow-brutal)]">
      {token.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- token images come from arbitrary IPFS/CDN hosts
        <img
          src={token.imageUrl}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full border-2 border-foreground object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-muted font-mono text-xs font-bold text-muted-foreground"
        >
          {(token.symbol ?? label).slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {label}
          {token.symbol && token.symbol !== label && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {token.symbol}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="mr-2 inline-block rounded-sm border border-foreground bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-secondary-foreground">
            {token.platform === "bags" ? "Bags" : "Pump.fun"}
          </span>
          {token.source === "partner" && (
            <span className="mr-2 inline-block rounded-sm border border-foreground bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-foreground">
              partner
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className="font-mono text-base font-bold tabular-nums text-foreground"
          title={`${formatSolExact(token.claimable)} SOL`}
        >
          {formatSol(token.claimable)} SOL
        </p>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          {token.totalEarned !== null
            ? `earned ${formatSol(token.totalEarned)} SOL`
            : "claimable"}
        </p>
      </div>
    </li>
  );
}
