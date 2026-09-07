import { NextRequest } from "next/server";
import { parseRecipeUpload } from "@/lib/archive";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const locale = (formData.get("locale") as Locale) || "de";

    if (!(file instanceof File)) {
      return Response.json({ error: "no-file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const recipes = await parseRecipeUpload(buffer, file.name, locale);

    if (recipes.length === 0) {
      return Response.json({ error: "no-recipes-found" }, { status: 400 });
    }

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
