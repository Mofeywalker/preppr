import { NextRequest } from "next/server";
import {
  getRecipe,
  updateRecipe,
  deleteRecipe,
  recipeInputSchema,
} from "@/lib/recipes";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await ctx.params;
  const recipe = await getRecipe(id, session?.user.id);
  if (!recipe) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(recipe);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = recipeInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    await updateRecipe(id, parsed.data, session.user.id);
    return Response.json({ id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed";
    return Response.json({ error: message }, { status: 403 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    await deleteRecipe(id, session.user.id);
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return Response.json({ error: message }, { status: 403 });
  }
}
