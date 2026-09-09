import { NextRequest } from "next/server";
import { getFullRecipes } from "@/lib/recipes";
import { exportRecipesToZip } from "@/lib/archive";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const recipes = await getFullRecipes(ids, session.user.id);
    if (recipes.length === 0) {
      return Response.json({ error: "no-recipes-found" }, { status: 404 });
    }

    const zipBuffer = await exportRecipesToZip(recipes);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename =
      recipes.length === 1
        ? `${recipes[0].title.toLowerCase().replace(/[^a-z0-9_-]+/gi, "-") || "recipe"}.zip`
        : `preppr-backup-${dateStr}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return Response.json(
      { error: "export-failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
