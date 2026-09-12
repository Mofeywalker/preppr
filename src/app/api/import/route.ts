import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  isYouTubeUrl,
  parseYouTubeId,
  getTranscript,
  getMetadata,
  downloadAudio,
  fetchYouTubeThumbnailBuffer,
} from "@/lib/youtube";
import {
  extractFromTranscript,
  extractFromAudio,
  extractFromWebpage,
  processYouTubeThumbnail,
  type ExtractedRecipe,
} from "@/lib/ai";
import { scrapeRecipeUrl } from "@/lib/scraper";
import { parseJsonLdRecipe } from "@/lib/jsonld-parser";
import { saveUploadedImage } from "@/lib/storage";
import type { Locale } from "@/i18n/routing";
import { getInstanceLocale } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { validateExternalUrl } from "@/lib/ssrf";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  url: z.string().url(),
  locale: z.enum(["de", "en"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 imports per minute per user
  const rl = rateLimit(`import:${session.user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid-url" }, { status: 400 });
  }
  const { url } = parsed.data;
  const locale: Locale = parsed.data.locale || getInstanceLocale();

  // Validate URL protocol and SSRF safety
  try {
    await validateExternalUrl(url);
  } catch {
    return Response.json({ error: "invalid-url" }, { status: 400 });
  }

  // --- FLOW 1: YOUTUBE VIDEO IMPORT ---
  if (isYouTubeUrl(url)) {
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({ error: "ai-config" }, { status: 503 });
    }
    const videoId = parseYouTubeId(url)!;

    let meta;
    try {
      meta = await getMetadata(url);
    } catch {
      meta = { title: "", description: "", thumbnail: null };
    }

    const transcript = await getTranscript(videoId);

    let recipe: ExtractedRecipe;
    try {
      if (transcript && transcript.length > 0) {
        recipe = await extractFromTranscript(transcript, meta.description, locale);
      } else {
        const { base64 } = await downloadAudio(url);
        recipe = await extractFromAudio(base64, meta.description, locale);
      }
    } catch (err) {
      const message = (err as Error).message ?? "";
      if (transcript === null) {
        return Response.json(
          { error: "no-transcript", detail: message },
          { status: 502 },
        );
      }
      return Response.json(
        { error: "extraction-failed", detail: message },
        { status: 502 },
      );
    }

    let thumbnail: string | null = null;
    const thumbBuf = await fetchYouTubeThumbnailBuffer(videoId, meta.thumbnail);

    if (thumbBuf) {
      let finalBuf = thumbBuf;
      let ext = "jpg";

      if (process.env.OPENROUTER_API_KEY) {
        try {
          const processedBase64 = await processYouTubeThumbnail(
            thumbBuf,
            recipe.title,
            recipe.description,
          );
          finalBuf = Buffer.from(processedBase64, "base64");
          ext = "png";
        } catch (imgErr) {
          console.warn(
            "Failed to process YouTube thumbnail with Gemini, falling back to original:",
            imgErr,
          );
        }
      }

      try {
        thumbnail = await saveUploadedImage(
          finalBuf,
          `${videoId}.${ext}`,
          `${videoId}-${Date.now()}.${ext}`,
        );
      } catch (saveErr) {
        console.warn("Failed to save uploaded YouTube thumbnail:", saveErr);
        thumbnail =
          meta.thumbnail ||
          (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : null);
      }
    } else if (meta.thumbnail) {
      thumbnail = meta.thumbnail;
    }

    return Response.json({
      recipe,
      thumbnail,
      sourceUrl: url,
      sourceType: "youtube",
    });
  }

  // --- FLOW 2: GENERIC RECIPE WEBSITE IMPORT ---
  try {
    const pageData = await scrapeRecipeUrl(url);

    let recipe: ExtractedRecipe | null = null;

    // 1. Try deterministic direct JSON-LD parsing first (no AI needed, instant & free)
    if (pageData.jsonLdRecipe) {
      recipe = parseJsonLdRecipe(pageData.jsonLdRecipe, locale);
    }

    // 2. Fallback to Gemini AI if no JSON-LD was found or parsing was incomplete
    if (!recipe) {
      if (!process.env.OPENROUTER_API_KEY) {
        return Response.json({ error: "ai-config" }, { status: 503 });
      }
      recipe = await extractFromWebpage(pageData, locale);
    }

    let thumbnail: string | null = pageData.imageUrl;
    if (thumbnail) {
      try {
        const res = await fetch(thumbnail, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          let ext = "jpg";
          if (contentType.includes("png")) ext = "png";
          else if (contentType.includes("webp")) ext = "webp";
          else if (contentType.includes("gif")) ext = "gif";

          const buf = Buffer.from(await res.arrayBuffer());
          thumbnail = await saveUploadedImage(buf, `${randomUUID()}.${ext}`);
        }
      } catch {
        // Fallback to external URL or null if download fails
      }
    }

    return Response.json({
      recipe,
      thumbnail,
      sourceUrl: url,
      sourceType: "website",
    });
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (message.includes("fetch-failed")) {
      return Response.json({ error: "fetch-failed", detail: message }, { status: 502 });
    }
    return Response.json({ error: "extraction-failed", detail: message }, { status: 502 });
  }
}
