/**
 * Read-only accrual alerts (PRD §5 week 1): a chat /watch-es a wallet; the
 * keeper rescans watched wallets on an interval and messages when claimable
 * grows. No keys, no claiming, no tx — alerts only.
 */
import { desc, eq } from "drizzle-orm";
import {
  BagsAdapter,
  PumpfunAdapter,
  scanAllPlatforms,
  type LaunchpadAdapter,
} from "@feesweep/adapters";
import { db, schema } from "@feesweep/core";
import { TelegramClient, type TgUpdate } from "./telegram";

const SOL = 1e9;

const POLL_INTERVAL_MS =
  Number(process.env.ALERT_INTERVAL_SEC ?? 300) * 1000;
/** Minimum claimable increase that triggers a message. */
const MIN_DELTA_LAMPORTS = BigInt(
  Math.round(Number(process.env.ALERT_MIN_DELTA_SOL ?? 0.01) * SOL),
);

function buildAdapters(): LaunchpadAdapter[] {
  const adapters: LaunchpadAdapter[] = [];
  if (process.env.BAGS_API_KEY) {
    adapters.push(new BagsAdapter(process.env.BAGS_API_KEY));
  }
  if (process.env.HELIUS_RPC_URL) {
    adapters.push(new PumpfunAdapter(process.env.HELIUS_RPC_URL));
  }
  return adapters;
}

function fmt(lamports: bigint): string {
  return (Number(lamports) / SOL).toFixed(4).replace(/\.?0+$/, "") || "0";
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function handleCommand(tg: TelegramClient, update: TgUpdate): Promise<void> {
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat.id;
  if (!text || chatId === undefined) return;

  const [command, arg] = text.split(/\s+/, 2);
  const chatIdStr = String(chatId);

  switch (command) {
    case "/start":
      await tg.sendMessage(
        chatId,
        "FeeSweep alerts — I message you when your creator fees grow.\n\n" +
          "/watch <wallet> — start watching a wallet\n" +
          "/unwatch <wallet> — stop\n" +
          "/list — wallets this chat watches\n\n" +
          "Read-only: I never touch keys and never claim.",
      );
      return;

    case "/watch": {
      if (!arg || !BASE58_RE.test(arg)) {
        await tg.sendMessage(chatId, "Usage: /watch <solana-wallet-address>");
        return;
      }
      await db()
        .insert(schema.wallets)
        .values({ address: arg, telegramChatId: chatIdStr })
        .onConflictDoUpdate({
          target: schema.wallets.address,
          set: { telegramChatId: chatIdStr },
        });
      await tg.sendMessage(
        chatId,
        `Watching ${arg}.\nYou'll hear from me when claimable fees grow by ≥ ${fmt(MIN_DELTA_LAMPORTS)} SOL.`,
      );
      return;
    }

    case "/unwatch": {
      if (!arg) {
        await tg.sendMessage(chatId, "Usage: /unwatch <solana-wallet-address>");
        return;
      }
      await db()
        .update(schema.wallets)
        .set({ telegramChatId: null })
        .where(eq(schema.wallets.address, arg));
      await tg.sendMessage(chatId, `Stopped watching ${arg}.`);
      return;
    }

    case "/list": {
      const rows = await db()
        .select({ address: schema.wallets.address })
        .from(schema.wallets)
        .where(eq(schema.wallets.telegramChatId, chatIdStr));
      await tg.sendMessage(
        chatId,
        rows.length
          ? `Watching:\n${rows.map((r) => r.address).join("\n")}`
          : "Not watching any wallets. Use /watch <wallet>.",
      );
      return;
    }
  }
}

async function checkWallet(
  tg: TelegramClient,
  adapters: LaunchpadAdapter[],
  wallet: { address: string; telegramChatId: string | null },
): Promise<void> {
  const result = await scanAllPlatforms(adapters, wallet.address);
  const claimable = result.tokens.reduce((s, t) => s + t.claimable, 0n);

  const [prev] = await db()
    .select({ total: schema.scans.totalClaimableLamports })
    .from(schema.scans)
    .where(eq(schema.scans.walletAddress, wallet.address))
    .orderBy(desc(schema.scans.scannedAt))
    .limit(1);

  await db().insert(schema.scans).values({
    walletAddress: wallet.address,
    tokens: result.tokens.map((t) => ({
      ...t,
      totalEarned: t.totalEarned?.toString() ?? null,
      claimable: t.claimable.toString(),
      accrualPerDay: t.accrualPerDay?.toString() ?? null,
    })),
    totalClaimableLamports: claimable,
    failedPlatforms: result.failedPlatforms,
  });

  if (!prev || !wallet.telegramChatId) return;
  const delta = claimable - prev.total;
  if (delta >= MIN_DELTA_LAMPORTS) {
    await tg.sendMessage(
      wallet.telegramChatId,
      `+${fmt(delta)} SOL accrued on ${wallet.address}\n` +
        `claimable now: ${fmt(claimable)} SOL`,
    );
  }
}

export async function runAlertLoop(): Promise<never> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const adapters = buildAdapters();
  if (adapters.length === 0) {
    throw new Error("no adapters configured — set BAGS_API_KEY / HELIUS_RPC_URL");
  }

  const tg = new TelegramClient(token);
  const me = await tg.me();
  console.log(`alerts: telegram bot @${me.username ?? "?"} online`);

  let lastAccrualCheck = 0;

  for (;;) {
    // Long poll for commands (30s); accrual checks piggyback the loop tick.
    try {
      const updates = await tg.poll(30);
      for (const u of updates) {
        try {
          await handleCommand(tg, u);
        } catch (err) {
          console.error("command failed:", err instanceof Error ? err.message : err);
        }
      }
    } catch (err) {
      console.error("poll failed:", err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (Date.now() - lastAccrualCheck >= POLL_INTERVAL_MS) {
      lastAccrualCheck = Date.now();
      try {
        const watched = await db()
          .select({
            address: schema.wallets.address,
            telegramChatId: schema.wallets.telegramChatId,
          })
          .from(schema.wallets);
        const active = watched.filter((w) => w.telegramChatId !== null);
        console.log(`alerts: checking ${active.length} watched wallet(s)`);
        for (const w of active) {
          try {
            await checkWallet(tg, adapters, w);
          } catch (err) {
            console.error(
              `check failed for ${w.address}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      } catch (err) {
        console.error("accrual sweep failed:", err instanceof Error ? err.message : err);
      }
    }
  }
}
