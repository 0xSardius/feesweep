const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Lamports (as decimal string from the wire) → display SOL.
 * Dynamic decimals per the number-formatting spec: big amounts need fewer
 * decimals, dust needs a floor marker instead of a wall of zeros.
 */
export function formatSol(lamports: string): string {
  const raw = BigInt(lamports);
  if (raw === 0n) return "0";
  const sol = Number(raw) / Number(LAMPORTS_PER_SOL);
  if (sol < 0.0001) return "<0.0001";
  const decimals = sol >= 100 ? 1 : sol >= 1 ? 2 : 4;
  return sol.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** Exact SOL value for tooltips / copy — never truncated. */
export function formatSolExact(lamports: string): string {
  const raw = BigInt(lamports);
  const whole = raw / LAMPORTS_PER_SOL;
  const frac = (raw % LAMPORTS_PER_SOL).toString().padStart(9, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
