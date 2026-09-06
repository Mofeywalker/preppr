import { NextRequest } from "next/server";
import { z } from "zod";
import {
  listRecipes,
  createRecipe,
  type RecipeInput,
} from "@/lib/recipes";

export const dynamic = "force-dynamic";

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
});

const inputSchema: z.ZodType<RecipeInput> = z.object({
  sourceType: z.enum(["manual", "youtube"]),
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
});

export async function GET() {
  const recipes = await listRecipes();
  return Response.json(recipes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const id = await createRecipe(parsed.data);
  return Response.json({ id }, { status: 201 });
}
