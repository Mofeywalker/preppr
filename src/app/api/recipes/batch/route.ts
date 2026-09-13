import { NextRequest } from "next/server";
import { z } from "zod";
import { createRecipesBatch, recipeInputSchema } from "@/lib/recipes";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const batchSchema = z.object({
  recipes: z.array(recipeInputSchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 batch operations per minute per user
  const rl = rateLimit(`batch:${session.user.id}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  try {
    const body = await req.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const ids = await createRecipesBatch(parsed.data.recipes, session.user.id);
    return Response.json({ success: true, count: ids.length, ids }, { status: 201 });
  } catch (err) {
    console.error("Batch creation failed:", err);
    return Response.json(
      { error: "server-error" },
      { status: 500 },
    );
  }
}
