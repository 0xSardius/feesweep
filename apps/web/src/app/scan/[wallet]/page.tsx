import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { address } from "@solana/kit";
import { runScan } from "@/lib/scan";
import { formatSol, truncateAddress } from "@/lib/format";
import { ScanResults } from "@/components/scan-results";

export const dynamic = "force-dynamic";

/** Dedupes the scan between generateMetadata and the page render. */
const scanCached = cache(runScan);

function validWallet(wallet: string): string | null {
  try {
    return address(wallet);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ wallet: string }>;
}): Promise<Metadata> {
  const { wallet } = await params;
  const valid = validWallet(wallet);
  if (!valid) return { title: "FeeSweep — scan" };

  const result = await scanCached(valid);
  const sol = formatSol(result.totals.claimableLamports);
  const title = `${sol} SOL sitting unclaimed — FeeSweep`;
  const description = `${truncateAddress(valid)} has ${sol} SOL of creator fees claimable across Bags + Pump.fun. Scan any wallet in 10 seconds.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedScanPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  const valid = validWallet(wallet);
  if (!valid) notFound();

  const result = await scanCached(valid);

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b-[3px] border-foreground">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            fee<span className="text-primary">sweep</span>
          </Link>
          <Link
            href="/"
            className="rounded-md border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-[var(--shadow-brutal)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            scan your wallet
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">
          scan result ·{" "}
          <span className="font-mono text-muted-foreground">
            {truncateAddress(valid)}
          </span>
        </h1>
        <div className="mt-6">
          <ScanResults result={result} />
        </div>
      </main>

      <footer className="border-t-2 border-foreground">
        <div className="mx-auto w-full max-w-2xl px-4 py-4">
          <p className="text-xs text-muted-foreground">
            live data at scan time. reads public chain + launchpad data only.
          </p>
        </div>
      </footer>
    </div>
  );
}
