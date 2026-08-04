/**
 * Fixed-window per-IP rate limiter for the public scan endpoint. A scan costs
 * upstream quota (Bags: 1,000 req/hr shared with the metrics job), so the
 * free scanner must not let one caller starve the platform budget.
 *
 * In-memory: on serverless this is per-instance, so the real-world ceiling is
 * limit × warm instances — coarse abuse protection, not precise accounting.
 * Good enough for MVP; move to Upstash/KV if launch traffic demands it.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    // Opportunistic cleanup so the map can't grow unbounded.
    if (buckets.size >= MAX_BUCKETS) {
      for (const [key, b] of buckets) {
        if (now - b.windowStart >= WINDOW_MS) buckets.delete(key);
      }
    }
    buckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSec: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}
