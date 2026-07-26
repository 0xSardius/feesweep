import { ImageResponse } from "next/og";
import { address } from "@solana/kit";
import { runScan } from "@/lib/scan";
import { formatSol, truncateAddress } from "@/lib/format";
import { loadOgFonts } from "@/lib/og-fonts";

export const alt = "Unclaimed Solana creator fees found by FeeSweep";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand hexes from brand.md — Satori can't read CSS variables.
const BG = "#071310";
const CARD = "#0E1E19";
const PRIMARY = "#35DF89";
const FG = "#F0F5F3";
const MUTED = "#9DB4AA";

export default async function Image({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;

  let sol = "0";
  let truncated = "";
  try {
    const valid = address(wallet);
    truncated = truncateAddress(valid);
    const result = await runScan(valid);
    sol = formatSol(result.totals.claimableLamports);
  } catch {
    // Invalid wallet or scan failure — render the generic card.
  }

  const { grotesk, mono } = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          padding: 48,
          fontFamily: "Grotesk",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: CARD,
            border: `6px solid ${FG}`,
            borderRadius: 12,
            boxShadow: `16px 16px 0 0 ${PRIMARY}`,
            padding: 56,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
              <span style={{ color: FG }}>fee</span>
              <span style={{ color: PRIMARY }}>sweep</span>
            </div>
            {truncated && (
              <div
                style={{
                  display: "flex",
                  fontFamily: "Mono",
                  fontSize: 28,
                  color: MUTED,
                }}
              >
                {truncated}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontFamily: "Mono",
                fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 160, color: PRIMARY, lineHeight: 1 }}>
                {sol}
              </span>
              <span style={{ fontSize: 64, color: FG, marginLeft: 24 }}>SOL</span>
            </div>
            <div style={{ display: "flex", fontSize: 40, color: FG, marginTop: 16 }}>
              sitting unclaimed in creator fees
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 28,
              color: MUTED,
            }}
          >
            <span>Bags + Pump.fun · live scan</span>
            <span>check yours in 10 seconds</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Grotesk", data: grotesk, weight: 700, style: "normal" },
        { name: "Mono", data: mono, weight: 700, style: "normal" },
      ],
    },
  );
}
