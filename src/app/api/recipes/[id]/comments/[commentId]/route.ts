import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  commentInputSchema,
  deleteRecipeComment,
  getRecipeComment,
  getRecipeForComments,
  updateRecipeComment,
} from "@/lib/recipe-comments";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(req: NextRequest, ctx: Context) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, commentId } = await ctx.params;
  const recipe = await getRecipeForComments(id, session.user.id);
  if (!recipe) return Response.json({ error: "not found" }, { status: 404 });

  const existing = await getRecipeComment(id, commentId);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });
  if (existing.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = commentInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const comment = await updateRecipeComment(id, commentId, parsed.data.body);
  if (!comment) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ comment });
}

export async function DELETE(req: NextRequest, ctx: Context) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, commentId } = await ctx.params;
  const recipe = await getRecipeForComments(id, session.user.id);
  if (!recipe) return Response.json({ error: "not found" }, { status: 404 });

  const existing = await getRecipeComment(id, commentId);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });
  const isRecipeOwner = !!recipe.userId && recipe.userId === session.user.id;
  if (existing.userId !== session.user.id && !isRecipeOwner) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await deleteRecipeComment(id, commentId);
  if (!deleted) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
