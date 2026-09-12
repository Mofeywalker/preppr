import { describe, it, expect } from "vitest";
import { parseYouTubeId, isYouTubeUrl } from "./youtube";

describe("youtube utilities", () => {
  describe("parseYouTubeId", () => {
    it("extracts video id from standard watch URLs", () => {
      expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(parseYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
      expect(parseYouTubeId("http://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts video id from short youtu.be URLs", () => {
      expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
    });

    it("extracts video id from shorts URLs", () => {
      expect(parseYouTubeId("https://www.youtube.com/shorts/abcdef12345")).toBe("abcdef12345");
      expect(parseYouTubeId("https://youtube.com/shorts/abcdef12345?feature=share")).toBe("abcdef12345");
    });

    it("extracts video id from embed URLs", () => {
      expect(parseYouTubeId("https://www.youtube.com/embed/abcdef12345")).toBe("abcdef12345");
    });

    it("extracts video id from live URLs", () => {
      expect(parseYouTubeId("https://www.youtube.com/live/abcdef12345")).toBe("abcdef12345");
    });

    it("returns null for non-YouTube or invalid URLs", () => {
      expect(parseYouTubeId("https://vimeo.com/12345678")).toBeNull();
      expect(parseYouTubeId("https://example.com/watch?v=1234")).toBeNull();
      expect(parseYouTubeId("not-a-url")).toBeNull();
      expect(parseYouTubeId("https://youtu.be/")).toBeNull();
    });
  });

  describe("isYouTubeUrl", () => {
    it("returns true for valid YouTube URLs and false otherwise", () => {
      expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
      expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
      expect(isYouTubeUrl("https://instagram.com/p/12345")).toBe(false);
      expect(isYouTubeUrl("invalid")).toBe(false);
    });
  });
});
