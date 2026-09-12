import { NextRequest } from "next/server";
import { parseRecipeUpload } from "@/lib/archive";
import { populateMissingNutrition } from "@/lib/ai";
import { getInstanceLocale, type Locale } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 JSON imports per minute per user
  const rl = rateLimit(`import-json:${session.user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.json !== "string") {
      return Response.json({ error: "no-json" }, { status: 400 });
    }

    const locale = (body.locale as Locale) || getInstanceLocale();

    // Strip markdown code fences if present (e.g. ```json ... ```)
    let cleaned = body.json.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    // Validate that it's valid JSON
    try {
      JSON.parse(cleaned);
    } catch {
      return Response.json(
        { error: "invalid-json", detail: "The provided text is not valid JSON." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(cleaned, "utf-8");
    const recipes = await parseRecipeUpload(buffer, "pasted.json", locale);

    if (recipes.length === 0) {
      return Response.json({ error: "no-recipes-found" }, { status: 400 });
    }

    await populateMissingNutrition(recipes);

    if (recipes.length === 1) {
      return Response.json({
        type: "single",
        recipe: recipes[0],
      });
    }

    return Response.json({
      type: "batch",
      recipes,
    });
  } catch (err) {
    console.error("Error importing JSON:", err);
    return Response.json(
      { error: "server-error", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
