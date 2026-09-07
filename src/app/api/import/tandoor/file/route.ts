import { NextRequest } from "next/server";
import { parseTandoorZip, tandoorToRecipeInput, saveUploadedImage, type TandoorRecipe } from "@/lib/tandoor";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const locale = (formData.get("locale") as Locale) || "en";

    if (!(file instanceof File)) {
      return Response.json({ error: "no-file" }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    if (filename.endsWith(".json")) {
      let rawJson: TandoorRecipe;
      try {
        rawJson = JSON.parse(buffer.toString("utf-8"));
      } catch {
        return Response.json({ error: "invalid-json" }, { status: 400 });
      }

      const recipe = tandoorToRecipeInput(rawJson, locale);
      return Response.json({
        type: "single",
        recipe,
      });
    }

    if (filename.endsWith(".zip")) {
      const extracted = await parseTandoorZip(buffer, locale);

      if (extracted.length === 0) {
        return Response.json({ error: "no-recipes-found" }, { status: 400 });
      }

      // Save images if present
      for (const item of extracted) {
        if (item.imageBuffer && item.imageExt) {
          try {
            const imageUrl = await saveUploadedImage(item.imageBuffer, `image.${item.imageExt}`);
            item.recipe.imageUrl = imageUrl;
          } catch (err) {
            console.error("Failed to save extracted image:", err);
          }
        }
      }

      if (extracted.length === 1) {
        return Response.json({
          type: "single",
          recipe: extracted[0].recipe,
        });
      }

      return Response.json({
        type: "batch",
        recipes: extracted.map((i) => i.recipe),
      });
    }

    return Response.json({ error: "unsupported-file-type" }, { status: 400 });
  } catch (err) {
    console.error("Error importing Tandoor file:", err);
    return Response.json({ error: "server-error", detail: (err as Error).message }, { status: 500 });
  }
}
