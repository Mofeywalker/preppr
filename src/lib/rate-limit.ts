/**
 * Simple in-memory sliding-window rate limiter.
 *
 * This does NOT persist across server restarts and is per-process only.
 * For multi-instance deployments, use Redis-backed rate limiting instead.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check and consume one token from a rate limit bucket.
 *
 * @param key      Unique key for the rate limit bucket (e.g. `"login:${ip}"`)
 * @param limit    Maximum number of requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  entry.count++;

  if (entry.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  return { ok: true, remaining: limit - entry.count, retryAfterMs: 0 };
}

/**
 * Returns a 429 JSON Response for rate-limited requests.
 */
export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return Response.json(
    { error: "too-many-requests", retryAfter: retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

/**
 * Extract a client identifier from a request for rate limiting.
 * Uses X-Forwarded-For (for reverse proxies) falling back to a generic key.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Next.js doesn't expose raw socket IP easily; fall back to a generic key
  // In production behind a reverse proxy, X-Forwarded-For should always be set
  return "unknown";
}

// Periodically clean up expired entries to prevent memory leaks
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (now > entry.resetAt) windows.delete(key);
    }
  };
  // Use a global flag to avoid registering multiple intervals in dev (HMR)
  const g = globalThis as typeof globalThis & { __rlCleanup?: boolean };
  if (!g.__rlCleanup) {
    g.__rlCleanup = true;
    setInterval(cleanup, 60_000).unref?.();
  }
}
