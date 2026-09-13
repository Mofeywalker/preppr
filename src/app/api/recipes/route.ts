import { NextRequest } from "next/server";
import {
  listRecipes,
  createRecipe,
  recipeInputSchema,
} from "@/lib/recipes";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const filter = req.nextUrl.searchParams.get("filter") as "all" | "mine" | "shared" | null;
  const recipes = await listRecipes(session.user.id, filter ?? "all");
  return Response.json(recipes);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = recipeInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const id = await createRecipe(parsed.data, session.user.id);
  return Response.json({ id }, { status: 201 });
}
