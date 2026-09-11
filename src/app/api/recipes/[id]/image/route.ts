import { NextRequest } from "next/server";
import { getRecipe, updateImage } from "@/lib/recipes";
import { generateRecipeImage, processYouTubeThumbnail } from "@/lib/ai";
import { parseYouTubeId, fetchYouTubeThumbnailBuffer } from "@/lib/youtube";
import { saveUploadedImage } from "@/lib/storage";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const name = `${id}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await saveUploadedImage(bytes, file.name, name);
    await updateImage(id, url);
    return Response.json({ url });
  }

  const body = await req.json().catch(() => ({}));
  if (body.generate) {
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
      const base64 = await generateRecipeImage(title, description);
      const name = `${id}.png`;
      const url = await saveUploadedImage(
        Buffer.from(base64, "base64"),
        "generated.png",
        name,
      );
      await updateImage(id, url);
      return Response.json({ url });
    } catch (err) {
      return Response.json(
        { error: (err as Error).message || "Failed to generate photo" },
        { status: 500 },
      );
    }
  }

  if (body.refetchYouTube) {
    if (recipe.sourceType !== "youtube" || !recipe.sourceUrl) {
      return Response.json(
        { error: "Recipe was not imported from YouTube" },
        { status: 400 },
      );
    }
    const videoId = parseYouTubeId(recipe.sourceUrl);
    if (!videoId) {
      return Response.json(
        { error: "Invalid YouTube URL" },
        { status: 400 },
      );
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({ error: "ai not configured" }, { status: 503 });
    }

    const thumbBuf = await fetchYouTubeThumbnailBuffer(videoId);
    if (!thumbBuf) {
      return Response.json(
        { error: "Failed to download YouTube thumbnail" },
        { status: 502 },
      );
    }

    try {
      const base64 = await processYouTubeThumbnail(
        thumbBuf,
        recipe.title,
        recipe.description,
      );
      const name = `${id}.png`;
      const url = await saveUploadedImage(
        Buffer.from(base64, "base64"),
        "youtube-processed.png",
        name,
      );
      await updateImage(id, url);
      return Response.json({ url });
    } catch (err) {
      return Response.json(
        { error: (err as Error).message || "Failed to process photo with AI" },
        { status: 500 },
      );
    }
  }

  return Response.json({ error: "bad request" }, { status: 400 });
}
