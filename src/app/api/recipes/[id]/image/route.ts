import { NextRequest } from "next/server";
import { getRecipe, updateImage } from "@/lib/recipes";
import { generateRecipeImage, transformRecipeImage } from "@/lib/ai";
import { saveUploadedImage, deleteUploadedImage, findUploadedImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 image operations per minute per user
  const rl = rateLimit(`recipe-image:${session.user.id}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const { id } = await ctx.params;
  const recipe = await getRecipe(id, session.user.id);
  if (!recipe) return Response.json({ error: "not found" }, { status: 404 });
  if (!recipe.isOwner) {
    return Response.json({ error: "Forbidden: Only owner can modify images" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "no file" }, { status: 400 });
    }

    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const mimeExt = file.type.startsWith("image/")
      ? file.type.split("/")[1]?.replace("jpeg", "jpg")
      : null;
    const ext = (extMatch ? extMatch[1].toLowerCase() : mimeExt) || "jpg";

    if (
      !file.type.startsWith("image/") &&
      !["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext)
    ) {
      return Response.json(
        { error: "Only image files are supported" },
        { status: 400 },
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return Response.json(
        { error: "File size exceeds 15MB limit" },
        { status: 400 },
      );
    }

    const name = `${id}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    if (recipe.imageUrl?.startsWith("/uploads/")) {
      await deleteUploadedImage(recipe.imageUrl);
    }
    const url = await saveUploadedImage(bytes, file.name, name);
    await updateImage(id, url, session.user.id);
    return Response.json({ url });
  }

  const body = await req.json().catch(() => ({}));
  if (body.generate || body.refetchYouTube) {
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({ error: "ai not configured" }, { status: 503 });
    }
    try {
      const title =
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : recipe.title;
      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : recipe.description;

      // The existing picture is used as the base - do NOT download the source photo again
      const baseImageUrl =
        typeof body.imageUrl === "string" && body.imageUrl.trim()
          ? body.imageUrl.trim()
          : recipe.imageUrl;

      let baseImageBuffer: Buffer | null = null;

      if (baseImageUrl) {
        if (baseImageUrl.startsWith("/uploads/")) {
          // Read directly from disk
          const found = await findUploadedImage(baseImageUrl);
          if (found) {
            baseImageBuffer = found.buffer;
          }
        } else if (
          baseImageUrl.startsWith("http://") ||
          baseImageUrl.startsWith("https://")
        ) {
          try {
            const resp = await fetch(baseImageUrl, {
              headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (resp.ok) {
              baseImageBuffer = Buffer.from(await resp.arrayBuffer());
            }
          } catch (fetchErr) {
            console.warn("Could not load base image for transformation:", fetchErr);
          }
        }
      }

      let base64: string;
      if (baseImageBuffer) {
        // Transform the existing picture with Gemini
        base64 = await transformRecipeImage(baseImageBuffer, title, description);
      } else {
        // Fallback to text-to-image if recipe has no base picture
        base64 = await generateRecipeImage(title, description);
      }

      const name = `${id}-${Date.now()}.png`;
      if (recipe.imageUrl?.startsWith("/uploads/")) {
        await deleteUploadedImage(recipe.imageUrl);
      }
      const url = await saveUploadedImage(
        Buffer.from(base64, "base64"),
        "generated.png",
        name,
      );
      await updateImage(id, url, session.user.id);
      return Response.json({ url });
    } catch (err) {
      console.error("Failed to generate recipe image:", err);
      return Response.json(
        { error: (err as Error).message || "Failed to generate photo" },
        { status: 500 },
      );
    }
  }

  return Response.json({ error: "bad request" }, { status: 400 });
}
