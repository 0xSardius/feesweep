"use client";

import { useState } from "react";
import type { ScanResponse } from "@/lib/scan";
import { ScanResults } from "@/components/scan-results";

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
