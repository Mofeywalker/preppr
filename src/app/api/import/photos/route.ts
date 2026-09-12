import { NextRequest } from "next/server";
import { extractFromPhotos, type ExtractedRecipe } from "@/lib/ai";
import { saveUploadedImage, getMimeType } from "@/lib/storage";
import { getInstanceLocale, type Locale } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per image
const MAX_TOTAL_SIZE = 60 * 1024 * 1024; // 60 MB total
const MAX_PHOTOS = 10;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 photo imports per minute per user
  const rl = rateLimit(`import-photos:${session.user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "ai-config" }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const locale = (formData.get("locale") as Locale) || getInstanceLocale();

    let files = formData.getAll("photos");
    if (files.length === 0) {
      files = formData.getAll("files");
    }

    const imageFiles = files.filter((f): f is File => f instanceof File && f.size > 0);

    if (imageFiles.length === 0) {
      return Response.json({ error: "no-photos" }, { status: 400 });
    }

    if (imageFiles.length > MAX_PHOTOS) {
      return Response.json(
        { error: "too-many-photos", detail: `Maximum ${MAX_PHOTOS} photos allowed` },
        { status: 400 },
      );
    }

    let totalSize = 0;
    const images: Array<{ buffer: Buffer; mimeType: string; name: string }> = [];

    for (const file of imageFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: "file-too-large", detail: "Each photo must be under 20 MB" },
          { status: 400 },
        );
      }
      totalSize += file.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        return Response.json(
          { error: "files-too-large", detail: "Total photo upload size exceeds 60 MB" },
          { status: 400 },
        );
      }

      const mime = file.type || getMimeType(file.name);
      if (!mime.startsWith("image/") && !file.name.match(/\.(jpe?g|png|webp|heic|heif|gif)$/i)) {
        return Response.json(
          { error: "invalid-file-type", detail: "Only image files are supported" },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      images.push({ buffer, mimeType: mime, name: file.name });
    }

    // Extract structured recipe using AI
    let recipe: ExtractedRecipe;
    try {
      recipe = await extractFromPhotos(images, locale);
    } catch (extractErr) {
      console.error("AI photo recipe extraction failed:", extractErr);
      return Response.json(
        {
          error: "extraction-failed",
          detail: (extractErr as Error).message ?? "Failed to extract recipe from photos",
        },
        { status: 502 },
      );
    }

    // Save the first photo to local storage to serve as the recipe's initial cover image
    let thumbnail: string | null = null;
    try {
      thumbnail = await saveUploadedImage(images[0].buffer, images[0].name);
    } catch (saveErr) {
      console.warn("Failed to save cover image from imported photo:", saveErr);
    }

    return Response.json({
      recipe,
      thumbnail,
      sourceType: "manual",
    });
  } catch (err) {
    console.error("Error processing photo import:", err);
    return Response.json(
      { error: "server-error", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
