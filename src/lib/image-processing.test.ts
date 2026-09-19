import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizeRecipeImage } from "./image-processing";

describe("normalizeRecipeImage", () => {
  it("normalizes a simple PNG image to JPEG format", async () => {
    // Create a simple 100x100 PNG
    const pngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await normalizeRecipeImage(pngBuffer, "screenshot.png");

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.name).toBe("screenshot.jpg");
    expect(result.buffer).toBeInstanceOf(Buffer);

    // Verify it is a valid JPEG
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  it("downscales images larger than 2048px while maintaining aspect ratio", async () => {
    // Create a 3000x1500 image (2:1 aspect ratio)
    const largeBuffer = await sharp({
      create: {
        width: 3000,
        height: 1500,
        channels: 3,
        background: { r: 0, g: 128, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await normalizeRecipeImage(largeBuffer, "huge-photo.jpg");

    expect(result.mimeType).toBe("image/jpeg");
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(2048);
    expect(metadata.height).toBe(1024);
  });

  it("does not upscale images smaller than 2048px", async () => {
    const smallBuffer = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 100, g: 200, b: 100 },
      },
    })
      .webp()
      .toBuffer();

    const result = await normalizeRecipeImage(smallBuffer, "mobile-capture.webp");

    expect(result.name).toBe("mobile-capture.jpg");
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
    expect(metadata.format).toBe("jpeg");
  });

  it("handles non-image buffer gracefully without crashing", async () => {
    const fakeBuffer = Buffer.from("not an image at all");
    const result = await normalizeRecipeImage(fakeBuffer, "corrupt.png");

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.name).toBe("corrupt.jpg");
    expect(result.buffer).toEqual(fakeBuffer);
  });
});

import { getMimeType } from "./storage";

describe("getMimeType", () => {
  it("returns correct mime types including heic and heif", () => {
    expect(getMimeType("photo.heic")).toBe("image/heic");
    expect(getMimeType("photo.HEIF")).toBe("image/heif");
    expect(getMimeType("recipe.jpg")).toBe("image/jpeg");
    expect(getMimeType("screenshot.png")).toBe("image/png");
    expect(getMimeType("scan.webp")).toBe("image/webp");
    expect(getMimeType("doc.pdf")).toBe("application/octet-stream");
  });
});

