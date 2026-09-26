import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { isYouTubeUrl, parseYouTubeId } from "@/lib/urls";
import {
  getTranscript,
  getMetadata,
  downloadAudio,
  fetchYouTubeThumbnailBuffer,
} from "@/lib/youtube";
import {
  extractFromTranscript,
  extractFromAudio,
  extractFromWebpage,
  estimateRecipeNutrition,
  processYouTubeThumbnail,
  type ExtractedRecipe,
} from "@/lib/ai";
import { scrapeRecipeUrl } from "@/lib/scraper";
import { parseJsonLdRecipe } from "@/lib/jsonld-parser";
import { saveUploadedImage } from "@/lib/storage";
import type { Locale } from "@/i18n/routing";
import { getInstanceLocale } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { validateExternalUrl } from "@/lib/ssrf";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  url: z.string().url(),
  locale: z.enum(["de", "en"]).optional(),
});

class ImportError extends Error {
  constructor(
    public code: string,
    public status: number = 502,
    detail?: string,
  ) {
    super(detail || code);
    this.name = "ImportError";
  }
}

async function executeImport(
  url: string,
  locale: Locale,
  onProgress?: (step: string) => void,
) {
  // --- FLOW 1: YOUTUBE VIDEO IMPORT ---
  if (isYouTubeUrl(url)) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new ImportError("ai-config", 503);
    }
    const videoId = parseYouTubeId(url)!;

    onProgress?.("youtube_meta");
    let meta;
    try {
      meta = await getMetadata(url);
    } catch {
      meta = { title: "", description: "", thumbnail: null };
    }

    const transcript = await getTranscript(videoId);

    onProgress?.("extracting_recipe");
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
        throw new ImportError("no-transcript", 502, message);
      }
      throw new ImportError("extraction-failed", 502, message);
    }

    let thumbnail: string | null = null;
    const thumbBuf = await fetchYouTubeThumbnailBuffer(videoId, meta.thumbnail);

    if (thumbBuf) {
      let finalBuf = thumbBuf;
      let ext = "jpg";

      if (process.env.OPENROUTER_API_KEY) {
        onProgress?.("generating_photo");
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

    return {
      recipe,
      thumbnail,
      sourceUrl: url,
      sourceType: "youtube" as const,
    };
  }

  // --- FLOW 2: GENERIC RECIPE WEBSITE IMPORT ---
  try {
    onProgress?.("scraping_web");
    const pageData = await scrapeRecipeUrl(url);

    let recipe: ExtractedRecipe | null = null;

    onProgress?.("extracting_recipe");
    // 1. Try deterministic direct JSON-LD parsing first (no AI needed, instant & free)
    if (pageData.jsonLdRecipe) {
      recipe = parseJsonLdRecipe(
        pageData.jsonLdRecipe,
        locale,
        pageData.domIngredients,
        pageData.domSectionedIngredients,
      );
    }

    // 2. Fallback to Gemini AI if no JSON-LD was found or parsing was incomplete
    if (!recipe) {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new ImportError("ai-config", 503);
      }
      recipe = await extractFromWebpage(pageData, locale);
    } else if (process.env.OPENROUTER_API_KEY && recipe.ingredients.length > 0) {
      // If JSON-LD recipe is missing base nutrition or missing fiber, auto-estimate it
      const hasBaseNutrition =
        recipe.nutrition.calories > 0 ||
        recipe.nutrition.proteinG > 0 ||
        recipe.nutrition.carbsG > 0 ||
        recipe.nutrition.fatG > 0;

      if (!hasBaseNutrition) {
        try {
          const estimated = await estimateRecipeNutrition({
            title: recipe.title,
            servings: recipe.servings,
            ingredients: recipe.ingredients,
          });
          recipe.nutrition = estimated;
        } catch (err) {
          console.warn("Failed to auto-estimate missing nutrition for JSON-LD recipe:", err);
        }
      } else if (recipe.nutrition.fiberG == null) {
        try {
          const estimated = await estimateRecipeNutrition({
            title: recipe.title,
            servings: recipe.servings,
            ingredients: recipe.ingredients,
          });
          recipe.nutrition.fiberG = estimated.fiberG;
        } catch (err) {
          console.warn("Failed to auto-estimate missing fiber for JSON-LD recipe:", err);
        }
      }
    }

    let thumbnail: string | null = pageData.imageUrl;
    if (thumbnail) {
      onProgress?.("loading_photo");
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

    return {
      recipe,
      thumbnail,
      sourceUrl: url,
      sourceType: "website" as const,
    };
  } catch (err) {
    if (err instanceof ImportError) throw err;
    const message = (err as Error).message ?? "";
    if (message.includes("fetch-failed")) {
      throw new ImportError("fetch-failed", 502, message);
    }
    throw new ImportError("extraction-failed", 502, message);
  }
}

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

  const wantsStream = req.headers.get("accept")?.includes("application/x-ndjson");

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };
        try {
          const result = await executeImport(url, locale, (step) => {
            send({ type: "status", step });
          });
          send({ type: "result", data: result });
        } catch (err) {
          if (err instanceof ImportError) {
            send({ type: "error", error: err.code, detail: err.message });
          } else {
            send({
              type: "error",
              error: "extraction-failed",
              detail: (err as Error).message,
            });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  try {
    const result = await executeImport(url, locale);
    return Response.json(result);
  } catch (err) {
    if (err instanceof ImportError) {
      return Response.json({ error: err.code, detail: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "extraction-failed", detail: (err as Error).message },
      { status: 502 },
    );
  }
}
