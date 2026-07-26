"use client";

import { useEffect, useState } from "react";
import type { ScanResponse, TokenFeeStateWire } from "@/lib/scan";
import { formatSol, formatSolExact, truncateAddress } from "@/lib/format";

export function ScanResults({ result }: { result: ScanResponse }) {
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
        <ShareRow result={result} />
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

function ShareRow({ result }: { result: ScanResponse }) {
  const [copied, setCopied] = useState(false);
  // Origin is only known in the browser; resolve after mount so the server
  // and client render the same href (avoids a hydration mismatch).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const shareUrl = `${origin}/scan/${result.wallet}`;

  const sol = formatSol(result.totals.claimableLamports);
  const text =
    result.tokens.length > 0
      ? `this wallet has ${sol} SOL of unclaimed creator fees sitting on the table`
      : `scanned my creator fees across Bags + Pump.fun in 10 seconds`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the X button still works.
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <a
        href={tweetHref}
        target="_blank"
        rel="noreferrer"
        className="rounded-md border-2 border-foreground bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-brutal)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        share on X
      </a>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="rounded-md border-2 border-foreground bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground shadow-[var(--shadow-brutal)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        {copied ? "copied!" : "copy link"}
      </button>
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
