import { NextRequest } from "next/server";
import { forkRecipe } from "@/lib/recipes";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const newId = await forkRecipe(id, session.user.id);
    return Response.json({ id: newId }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to copy recipe";
    return Response.json({ error: message }, { status: 400 });
  }
}
