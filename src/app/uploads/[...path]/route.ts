import { NextRequest } from "next/server";
import { findUploadedImage, getMimeType } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await ctx.params;
    if (!path || path.length === 0 || path.some((p) => p === ".." || p === ".")) {
      return Response.json({ error: "bad-request" }, { status: 400 });
    }

    const filename = path.join("/");
    const found = await findUploadedImage(filename);
    if (!found) {
      return Response.json({ error: "not-found" }, { status: 404 });
    }

    return new Response(new Uint8Array(found.buffer), {
      status: 200,
      headers: {
        "Content-Type": getMimeType(filename),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Error serving uploaded image:", err);
    return Response.json({ error: "server-error" }, { status: 500 });
  }
}
