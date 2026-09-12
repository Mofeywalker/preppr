import { NextRequest } from "next/server";
import { parseRecipeUpload } from "@/lib/archive";
import { populateMissingNutrition } from "@/lib/ai";
import { getInstanceLocale, type Locale } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 file imports per minute per user
  const rl = rateLimit(`import-file:${session.user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const locale = (formData.get("locale") as Locale) || getInstanceLocale();

    if (!(file instanceof File)) {
      return Response.json({ error: "no-file" }, { status: 400 });
    }

    if (file.size > MAX_IMPORT_SIZE) {
      return Response.json(
        { error: "file-too-large", detail: "Maximum file size is 50 MB" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const recipes = await parseRecipeUpload(buffer, file.name, locale);

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
    console.error("Error importing file:", err);
    return Response.json(
      { error: "server-error", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
