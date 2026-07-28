/**
 * Minimal Telegram Bot API client — long polling + sendMessage. No framework:
 * the surface we need is tiny and the keeper should have few moving parts.
 */

export interface TgUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat: { id: number };
  };
}

export class TelegramClient {
  private offset = 0;

  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, payload?: unknown): Promise<T> {
    const res = await this.fetchImpl(
      `https://api.telegram.org/bot${this.token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      },
    );
    const body = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!body.ok) {
      throw new Error(`telegram ${method} failed: ${body.description ?? res.status}`);
    }
    return body.result as T;
  }

  /** Long-poll for updates; advances the offset so updates arrive once. */
  async poll(timeoutSec = 30): Promise<TgUpdate[]> {
    const updates = await this.call<TgUpdate[]>("getUpdates", {
      offset: this.offset,
      timeout: timeoutSec,
      allowed_updates: ["message"],
    });
    for (const u of updates) {
      this.offset = Math.max(this.offset, u.update_id + 1);
    }
    return updates;
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      // No Markdown parse mode: wallet addresses contain underscores and we
      // never want a formatting error to eat an alert.
      disable_web_page_preview: true,
    });
  }

  async me(): Promise<{ username?: string }> {
    return this.call<{ username?: string }>("getMe");
  }
}
