import { NextRequest } from "next/server";
import { getFullRecipes } from "@/lib/recipes";
import { exportRecipesToZip } from "@/lib/archive";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const recipes = await getFullRecipes([id], session.user.id);
    if (recipes.length === 0) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const recipe = recipes[0];
    const zipBuffer = await exportRecipesToZip([recipe]);

    const safeTitle = recipe.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "recipe";
    const filename = `${safeTitle}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Single recipe export error:", err);
    return Response.json(
      { error: "export-failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
