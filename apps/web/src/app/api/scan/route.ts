import { NextResponse } from "next/server";
import { address } from "@solana/kit";
import { runScan } from "@/lib/scan";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  try {
    address(wallet);
  } catch {
    return NextResponse.json(
      { error: "not a valid Solana address" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await runScan(wallet));
  } catch (err) {
    console.error("scan failed:", err);
    return NextResponse.json(
      { error: "scan failed — try again in a moment" },
      { status: 502 },
    );
  }
}
