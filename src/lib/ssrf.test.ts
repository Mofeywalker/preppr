import { describe, it, expect, vi } from "vitest";
import { validateExternalUrl } from "./ssrf";

// Mock dns lookup to control resolved IPs deterministically
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === "blocked-internal.example") {
      return { address: "127.0.0.1", family: 4 };
    }
    if (hostname === "metadata-resolved.example") {
      return { address: "169.254.169.254", family: 4 };
    }
    if (hostname === "valid.example") {
      return { address: "93.184.216.34", family: 4 };
    }
    if (hostname === "lan.local") {
      return { address: "192.168.1.100", family: 4 };
    }
    const err = new Error("ENOTFOUND");
    throw err;
  }),
}));

describe("validateExternalUrl", () => {
  it("rejects non-HTTP/HTTPS protocols", async () => {
    await expect(validateExternalUrl("ftp://example.com/file")).rejects.toThrow(
      "Only HTTP(S) URLs are allowed"
    );
    await expect(validateExternalUrl("file:///etc/passwd")).rejects.toThrow(
      "Only HTTP(S) URLs are allowed"
    );
    await expect(validateExternalUrl("javascript:alert(1)")).rejects.toThrow(
      "Only HTTP(S) URLs are allowed"
    );
  });

  it("blocks direct localhost and loopback addresses", async () => {
    await expect(validateExternalUrl("http://localhost:3000")).rejects.toThrow(
      "Requests to localhost/metadata endpoints are not allowed"
    );
    await expect(validateExternalUrl("http://127.0.0.1/admin")).rejects.toThrow(
      "Requests to localhost/metadata endpoints are not allowed"
    );
    await expect(validateExternalUrl("http://[::1]:8080")).rejects.toThrow(
      "Requests to localhost/metadata endpoints are not allowed"
    );
    await expect(validateExternalUrl("http://0.0.0.0")).rejects.toThrow(
      "Requests to localhost/metadata endpoints are not allowed"
    );
  });

  it("blocks cloud metadata hostnames and IP ranges", async () => {
    await expect(validateExternalUrl("http://metadata.google.internal/computeMetadata/v1/")).rejects.toThrow(
      "Requests to localhost/metadata endpoints are not allowed"
    );
    await expect(validateExternalUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      "Requests to blocked IP ranges are not allowed"
    );
  });

  it("blocks hostnames that resolve to blocked IPs via DNS", async () => {
    await expect(validateExternalUrl("http://blocked-internal.example/api")).rejects.toThrow(
      "Requests to blocked IP ranges are not allowed"
    );
    await expect(validateExternalUrl("http://metadata-resolved.example/test")).rejects.toThrow(
      "Requests to blocked IP ranges are not allowed"
    );
  });

  it("allows valid external public domains", async () => {
    await expect(validateExternalUrl("https://valid.example/recipes/123")).resolves.toBeUndefined();
  });

  it("allows private LAN IPs for self-hosted instances", async () => {
    await expect(validateExternalUrl("http://192.168.1.50:8080/recipe")).resolves.toBeUndefined();
    await expect(validateExternalUrl("http://lan.local:8080/recipe")).resolves.toBeUndefined();
  });
});
