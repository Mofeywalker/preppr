import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  commentInputSchema,
  createRecipeComment,
  getRecipeForComments,
  listRecipeComments,
} from "@/lib/recipe-comments";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Context) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await ctx.params;
  const recipe = await getRecipeForComments(id, session?.user.id);
  if (!recipe) return Response.json({ error: "not found" }, { status: 404 });

  const comments = await listRecipeComments(id);
  return Response.json({ comments });
}

export async function POST(req: NextRequest, ctx: Context) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const recipe = await getRecipeForComments(id, session.user.id);
  if (!recipe) return Response.json({ error: "not found" }, { status: 404 });

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

  const comment = await createRecipeComment(id, session.user.id, parsed.data.body);
  return Response.json({ comment }, { status: 201 });
}
