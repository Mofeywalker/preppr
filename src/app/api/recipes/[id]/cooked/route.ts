import { NextRequest } from "next/server";
import { toggleRecipeCooked } from "@/lib/recipes";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await ctx.params;

  let forceState: boolean | undefined;
  try {
    const text = await req.text();
    if (text) {
      const body = JSON.parse(text);
      if (typeof body?.isCooked === "boolean") {
        forceState = body.isCooked;
      }
    }
  } catch {
    // Ignore body parse errors, fallback to toggle
  }

  try {
    const result = await toggleRecipeCooked(id, session?.user?.id, forceState);
    return Response.json({ ok: true, isCooked: result.isCooked });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Toggle failed";
    const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
