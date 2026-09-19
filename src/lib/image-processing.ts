import sharp from "sharp";

export interface NormalizedImage {
  buffer: Buffer;
  mimeType: string;
  name: string;
}

/**
 * Normalizes an uploaded recipe photo or screenshot:
 * 1. Auto-rotates using EXIF orientation tags (fixes sideways/upside-down photos from smartphones).
 * 2. Downscales if larger than 2048px on any side, preserving full aspect ratio and OCR readability
 *    while drastically reducing payload size.
 * 3. Converts HEIC, HEIF, PNG, WebP, TIFF, etc. to standard, high-quality JPEG for maximum
 *    compatibility with vision LLMs and browsers.
 */
export async function normalizeRecipeImage(
  buffer: Buffer,
  originalFilename: string = "image.jpg",
): Promise<NormalizedImage> {
  const baseName = originalFilename.replace(/\.[a-zA-Z0-9]+$/, "");
  const normalizedName = `${baseName || "image"}.jpg`;

  try {
    const pipeline = sharp(buffer, { failOn: "none" })
      .rotate() // Auto-orient based on EXIF
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        mozjpeg: true,
      });

    const normalizedBuffer = await pipeline.toBuffer();

    return {
      buffer: normalizedBuffer,
      mimeType: "image/jpeg",
      name: normalizedName,
    };
  } catch (err) {
    console.warn(`sharp image normalization failed for ${originalFilename}, using fallback:`, err);
    // Fallback: If sharp fails on an unusual format, return original buffer
    return {
      buffer,
      mimeType: "image/jpeg",
      name: normalizedName,
    };
  }
}
