import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit, rateLimitResponse, getClientIp } from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe("rateLimit", () => {
    it("allows requests up to the configured limit", () => {
      const key = "test-client-1";
      const limit = 3;
      const windowMs = 10_000;

      const res1 = rateLimit(key, limit, windowMs);
      expect(res1.ok).toBe(true);
      expect(res1.remaining).toBe(2);
      expect(res1.retryAfterMs).toBe(0);

      const res2 = rateLimit(key, limit, windowMs);
      expect(res2.ok).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = rateLimit(key, limit, windowMs);
      expect(res3.ok).toBe(true);
      expect(res3.remaining).toBe(0);
    });

    it("blocks requests that exceed the limit", () => {
      const key = "test-client-2";
      const limit = 2;
      const windowMs = 5000;

      rateLimit(key, limit, windowMs);
      rateLimit(key, limit, windowMs);

      const blocked = rateLimit(key, limit, windowMs);
      expect(blocked.ok).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(5000);
    });

    it("resets after the window expires", () => {
      const key = "test-client-3";
      const limit = 1;
      const windowMs = 2000;

      expect(rateLimit(key, limit, windowMs).ok).toBe(true);
      expect(rateLimit(key, limit, windowMs).ok).toBe(false);

      vi.advanceTimersByTime(2001);

      const resAfterExpiry = rateLimit(key, limit, windowMs);
      expect(resAfterExpiry.ok).toBe(true);
      expect(resAfterExpiry.remaining).toBe(0);
    });
  });

  describe("rateLimitResponse", () => {
    it("returns a 429 response with json error and Retry-After header", async () => {
      const resp = rateLimitResponse(4500);
      expect(resp.status).toBe(429);
      expect(resp.headers.get("Retry-After")).toBe("5"); // Math.ceil(4500 / 1000)

      const body = await resp.json();
      expect(body).toEqual({
        error: "too-many-requests",
        retryAfter: 5,
      });
    });
  });

  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for header (first IP in comma list)", () => {
      const req = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("falls back to 'unknown' when header is missing", () => {
      const req = new Request("https://example.com");
      expect(getClientIp(req)).toBe("unknown");
    });
  });
});
