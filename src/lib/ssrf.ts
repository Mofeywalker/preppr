import { lookup } from "node:dns/promises";

/**
 * IP ranges that should be blocked for outbound server-side fetches to prevent SSRF.
 *
 * For a self-hosted app, we intentionally ALLOW private LAN IPs (10.x, 192.168.x, 172.16-31.x)
 * because users commonly import from other self-hosted services on the same network.
 *
 * We DO block:
 * - Cloud metadata endpoints (169.254.x.x link-local)
 * - Localhost / loopback (127.x.x.x, ::1)
 * - Unspecified address (0.0.0.0)
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./, // IPv4 loopback
  /^0\./, // unspecified
  /^169\.254\./, // link-local / cloud metadata (AWS, GCP, Azure)
  /^::1$/, // IPv6 loopback
  /^fe80:/i, // IPv6 link-local
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
]);

function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some((r) => r.test(ip));
}

/**
 * Validates that a URL is safe to fetch server-side (anti-SSRF).
 * Throws an Error if the URL points to a blocked destination.
 */
export async function validateExternalUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP(S) URLs are allowed");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new Error("Requests to localhost/metadata endpoints are not allowed");
  }

  // Check if the hostname is a raw IP
  if (isBlockedIp(hostname)) {
    throw new Error("Requests to blocked IP ranges are not allowed");
  }

  // Resolve DNS and check the resolved IP
  try {
    const { address } = await lookup(hostname);
    if (isBlockedIp(address)) {
      throw new Error("Requests to blocked IP ranges are not allowed");
    }
  } catch (err) {
    if ((err as Error).message.includes("not allowed")) throw err;
    // DNS resolution failure is OK — the subsequent fetch will fail with a clearer error
  }
}
