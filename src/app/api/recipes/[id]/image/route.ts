import { NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getRecipe, updateImage } from "@/lib/recipes";
import { generateRecipeImage } from "@/lib/ai";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/recipes/[id]">,
) {
  const { id } = await ctx.params;
  const recipe = await getRecipe(id);
  if (!recipe) return Response.json({ error: "not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "no file" }, { status: 400 });
    }
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const name = `${id}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, name), bytes);
    const url = `/uploads/${name}`;
    await updateImage(id, url);
    return Response.json({ url });
  }

  const body = await req.json().catch(() => ({}));
  if (body.generate) {
    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "ai not configured" }, { status: 503 });
    }
    try {
      const base64 = await generateRecipeImage(
        recipe.title,
        recipe.description,
      );
      await mkdir(UPLOAD_DIR, { recursive: true });
      const name = `${id}.png`;
      await writeFile(join(UPLOAD_DIR, name), Buffer.from(base64, "base64"));
      const url = `/uploads/${name}`;
      await updateImage(id, url);
      return Response.json({ url });
    } catch (err) {
      return Response.json(
        { error: (err as Error).message },
        { status: 500 },
      );
    }
  }

  return Response.json({ error: "bad request" }, { status: 400 });
}
