import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/ssrf", () => ({
  validateExternalUrl: vi.fn().mockResolvedValue(undefined),
}));

import { fetchWebpage } from "./scraper";

const CHALLENGE =
  '<html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue</body></html>';

function mockFetchSequence(responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWebpage", () => {
  it("falls back to the reader proxy on a Cloudflare challenge", async () => {
    const fn = mockFetchSequence([
      new Response(CHALLENGE, { status: 403 }),
      new Response("<html><body>recipe page</body></html>", { status: 200 }),
    ]);

    const html = await fetchWebpage("https://example.com/recipe");

    expect(html).toContain("recipe page");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toBe("https://r.jina.ai/https://example.com/recipe");
  });

  it("returns the page directly when no challenge is present", async () => {
    const fn = mockFetchSequence([new Response("<html><title>ok</title></html>", { status: 200 })]);

    const html = await fetchWebpage("https://example.com/recipe");

    expect(html).toContain("<title>ok</title>");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reports the original HTTP failure when the reader also fails", async () => {
    mockFetchSequence([
      new Response(CHALLENGE, { status: 403 }),
      new Response("blocked", { status: 429 }),
    ]);

    await expect(fetchWebpage("https://example.com/recipe")).rejects.toThrow(
      "fetch-failed: 403",
    );
  });
});
