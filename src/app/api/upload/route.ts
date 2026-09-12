import { NextRequest } from "next/server";
import { saveUploadedImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 uploads per minute per user
  const rl = rateLimit(`upload:${session.user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
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

  // Block SVG uploads — they can contain embedded JavaScript (stored XSS)
  if (ext === "svg" || file.type === "image/svg+xml") {
    return Response.json(
      { error: "SVG files are not supported for security reasons" },
      { status: 400 },
    );
  }

  // 15MB max file size
  if (file.size > 15 * 1024 * 1024) {
    return Response.json(
      { error: "File size exceeds 15MB limit" },
      { status: 400 },
    );
  }

  const name = `${randomUUID()}-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await saveUploadedImage(bytes, file.name, name);

  return Response.json({ url });
}
