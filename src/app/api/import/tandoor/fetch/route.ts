import { NextRequest } from "next/server";
import { z } from "zod";
import { tandoorToRecipeInput, saveUploadedImage, type TandoorRecipe } from "@/lib/tandoor";
import { populateMissingNutrition } from "@/lib/ai";
import { getInstanceLocale, type Locale } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const fetchBodySchema = z.object({
  url: z.string().url(),
  apiToken: z.string().optional(),
  locale: z.enum(["de", "en"]).optional(),
  recipeIds: z.array(z.union([z.number(), z.string()])).optional(),
});

function extractRecipeId(pathname: string): string | null {
  const match = pathname.match(/\/(?:view\/)?recipes?\/(\d+)/i) || pathname.match(/\/api\/recipe\/(\d+)/i);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 Tandoor fetches per minute per user
  const rl = rateLimit(`tandoor-fetch:${session.user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  try {
    const json = await req.json();
    const parsed = fetchBodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "invalid-request", issues: parsed.error.issues }, { status: 400 });
    }

    const { url, apiToken, recipeIds } = parsed.data;
    const locale: Locale = parsed.data.locale || getInstanceLocale();

    const parsedUrl = new URL(url);
    const headers: Record<string, string> = {};
    if (apiToken?.trim()) {
      headers["Authorization"] = `Bearer ${apiToken.trim()}`;
    }

    // Helper to download an image from Tandoor and save locally
    const downloadAndSaveImage = async (imgUrl: string, baseUrl: string): Promise<string | null> => {
      try {
        const fullImgUrl = imgUrl.startsWith("http://") || imgUrl.startsWith("https://")
          ? imgUrl
          : new URL(imgUrl, baseUrl).toString();

        const imgRes = await fetch(fullImgUrl, { headers });
        if (!imgRes.ok) return null;
        const arrayBuf = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const extMatch = imgUrl.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
        return await saveUploadedImage(buffer, `image.${ext}`);
      } catch (err) {
        console.error("Failed to download image from Tandoor:", err);
        return null;
      }
    };

    // Helper to fetch full recipe from Tandoor API
    const fetchFullRecipe = async (baseUrl: string, id: string | number): Promise<TandoorRecipe | null> => {
      const apiUrl = new URL(`/api/recipe/${id}/`, baseUrl).toString();
      const res = await fetch(apiUrl, { headers });
      if (!res.ok) return null;
      return (await res.json()) as TandoorRecipe;
    };

    // Case 1: Fetch specific batch of recipe IDs from instance
    if (recipeIds && recipeIds.length > 0) {
      const baseUrl = parsedUrl.origin;
      const results = [];

      for (const id of recipeIds) {
        const raw = await fetchFullRecipe(baseUrl, id);
        if (raw) {
          let localImageUrl: string | null = null;
          if (raw.image) {
            localImageUrl = await downloadAndSaveImage(raw.image, baseUrl);
          }
          const recipeInput = tandoorToRecipeInput(raw, locale, {
            sourceUrl: raw.source_url || new URL(`/view/recipe/${id}/`, baseUrl).toString(),
            imageUrl: localImageUrl,
          });
          results.push(recipeInput);
        }
      }

      await populateMissingNutrition(results);

      return Response.json({
        type: "batch",
        recipes: results,
      });
    }

    // Case 2: Direct recipe URL (e.g. /view/recipe/42 or /api/recipe/42/)
    const singleRecipeId = extractRecipeId(parsedUrl.pathname);
    if (singleRecipeId) {
      const baseUrl = parsedUrl.origin;
      const raw = await fetchFullRecipe(baseUrl, singleRecipeId);
      if (!raw) {
        return Response.json({ error: "recipe-not-found" }, { status: 404 });
      }

      let localImageUrl: string | null = null;
      if (raw.image) {
        localImageUrl = await downloadAndSaveImage(raw.image, baseUrl);
      }

      const recipeInput = tandoorToRecipeInput(raw, locale, {
        sourceUrl: raw.source_url || url,
        imageUrl: localImageUrl,
      });

      await populateMissingNutrition([recipeInput]);

      return Response.json({
        type: "single",
        recipe: recipeInput,
      });
    }

    // Case 3: Instance base URL -> Fetch recipe list
    const listApiUrl = new URL("/api/recipe/", parsedUrl.origin).toString();
    const listRes = await fetch(listApiUrl, { headers });
    if (!listRes.ok) {
      return Response.json(
        { error: "connection-failed", statusText: listRes.statusText },
        { status: listRes.status === 401 || listRes.status === 403 ? 401 : 502 },
      );
    }

    const listData = await listRes.json();
    const items: Array<{ id: number | string; name: string; description?: string; image?: string }> = Array.isArray(
      listData,
    )
      ? listData
      : Array.isArray(listData.results)
        ? listData.results
        : [];

    return Response.json({
      type: "list",
      recipes: items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description || null,
        image: i.image ? (i.image.startsWith("http") ? i.image : new URL(i.image, parsedUrl.origin).toString()) : null,
      })),
    });
  } catch (err) {
    console.error("Error fetching from Tandoor:", err);
    return Response.json({ error: "server-error", detail: (err as Error).message }, { status: 500 });
  }
}
