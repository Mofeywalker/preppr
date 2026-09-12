import { NextRequest } from "next/server";
import { z } from "zod";
import { createRecipesBatch, type RecipeInput } from "@/lib/recipes";
import { auth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
});

const recipeInputSchema: z.ZodType<RecipeInput> = z.object({
  sourceType: z.enum(["manual", "youtube", "tandoor", "website"]),
  sourceUrl: z.string().nullable().optional(),
  language: z.enum(["de", "en"]),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  servings: z.number().int().min(1).max(100),
  prepTimeMin: z.number().int().nullable().optional(),
  cookTimeMin: z.number().int().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  calories: z.number().nullable().optional(),
  proteinG: z.number().nullable().optional(),
  carbsG: z.number().nullable().optional(),
  fatG: z.number().nullable().optional(),
  fiberG: z.number().nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(["private", "shared"]).optional(),
});

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
