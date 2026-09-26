import { describe, it, expect } from "vitest";
import { extractUrlFromShareData, parseYouTubeId, isYouTubeUrl } from "./urls";

describe("extractUrlFromShareData", () => {
  it("returns empty string when url and text are empty or missing", () => {
    expect(extractUrlFromShareData()).toBe("");
    expect(extractUrlFromShareData(null, null)).toBe("");
    expect(extractUrlFromShareData("", "")).toBe("");
  });

  it("extracts a clean direct URL", () => {
    expect(extractUrlFromShareData("https://example.com/recipe")).toBe("https://example.com/recipe");
    expect(extractUrlFromShareData("http://example.com/recipe")).toBe("http://example.com/recipe");
  });

  it("extracts URL embedded in text (e.g. from YouTube or Twitter share sheets)", () => {
    const text = "Check out this amazing recipe: https://youtu.be/abc12345! Hope you like it.";
    expect(extractUrlFromShareData(undefined, text)).toBe("https://youtu.be/abc12345");
  });

  it("strips trailing punctuation often appended by apps or sentences", () => {
    expect(extractUrlFromShareData("https://example.com/recipe.")).toBe("https://example.com/recipe");
    expect(extractUrlFromShareData("https://example.com/recipe,")).toBe("https://example.com/recipe");
    expect(extractUrlFromShareData("https://example.com/recipe?")).toBe("https://example.com/recipe");
    expect(extractUrlFromShareData("(https://example.com/recipe)")).toBe("https://example.com/recipe");
    expect(extractUrlFromShareData("<https://example.com/recipe>")).toBe("https://example.com/recipe");
  });

  it("prefers URL from combined url and text", () => {
    const url = "https://example.com/recipe";
    const text = "Delicious cake";
    expect(extractUrlFromShareData(url, text)).toBe("https://example.com/recipe");
  });

  it("returns empty string if neither url nor text contain a valid http/https link", () => {
    expect(extractUrlFromShareData("just plain text", "more text")).toBe("");
    expect(extractUrlFromShareData("ftp://example.com/file")).toBe("");
  });
});

describe("parseYouTubeId & isYouTubeUrl", () => {
  it("identifies valid YouTube URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(isYouTubeUrl("https://example.com/recipe")).toBe(false);
  });
});
