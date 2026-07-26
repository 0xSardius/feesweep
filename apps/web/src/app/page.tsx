import { Scanner } from "@/components/scanner";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b-[3px] border-foreground">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
          <p className="text-lg font-bold tracking-tight">
            fee<span className="text-primary">sweep</span>
          </p>
          <p className="rounded-sm border-2 border-foreground bg-primary px-2 py-1 font-mono text-[10px] font-bold uppercase text-primary-foreground">
            free scan
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          how much are you owed?
        </h1>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">
          every creator fee you&apos;ve earned across Bags and Pump.fun — and
          what&apos;s sitting unclaimed. paste any wallet. no connect, no
          signature.
        </p>
        <div className="mt-8">
          <Scanner />
        </div>
      </main>

      <footer className="border-t-2 border-foreground">
        <div className="mx-auto w-full max-w-2xl px-4 py-4">
          <p className="text-xs text-muted-foreground">
            reads public chain + launchpad data only. nothing is stored about
            you beyond the scan.
          </p>
        </div>
      </footer>
    </div>
  );
}
