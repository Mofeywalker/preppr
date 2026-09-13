import { db, schema } from "@/db/client";
import { eq, inArray, asc, desc, sql, or, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
});

export type RecipeInput = {
  sourceType: "manual" | "youtube" | "tandoor" | "website";
  sourceUrl?: string | null;
  language: "de" | "en";
  title: string;
  description?: string | null;
  servings: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  imageUrl?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  ingredients: { name: string; quantity?: number | null; unit?: string | null }[];
  steps: string[];
  tags?: string[];
  visibility?: "private" | "shared";
  isCooked?: boolean;
};

export const recipeInputSchema: z.ZodType<RecipeInput> = z.object({
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
  isCooked: z.boolean().optional(),
});

export type Recipe = schema.Recipe;
export type RecipeWithTags = schema.Recipe & {
  tags: string[];
  isOwner: boolean;
  authorName?: string | null;
  authorImage?: string | null;
};
export type FullRecipe = schema.Recipe & {
  ingredients: schema.Ingredient[];
  steps: schema.Step[];
  tags: string[];
  isOwner: boolean;
  authorName?: string | null;
  authorImage?: string | null;
};

export async function listRecipes(
  userId?: string,
  filter?: "all" | "mine" | "shared",
): Promise<RecipeWithTags[]> {
  const whereCondition =
    filter === "mine"
      ? eq(schema.recipes.userId, userId || "")
      : filter === "shared"
      ? eq(schema.recipes.visibility, "shared")
      : userId
      ? or(
          eq(schema.recipes.visibility, "shared"),
          eq(schema.recipes.userId, userId),
          isNull(schema.recipes.userId),
        )
      : eq(schema.recipes.visibility, "shared");

  const [recipeRows, tagLinks] = await Promise.all([
    db
      .select({
        recipe: schema.recipes,
        authorName: schema.user.name,
        authorImage: schema.user.image,
      })
      .from(schema.recipes)
      .leftJoin(schema.user, eq(schema.recipes.userId, schema.user.id))
      .where(whereCondition)
      .orderBy(desc(schema.recipes.createdAt)),
    db
      .select({
        recipeId: schema.recipeTags.recipeId,
        tagName: schema.tags.name,
      })
      .from(schema.recipeTags)
      .innerJoin(schema.tags, eq(schema.recipeTags.tagId, schema.tags.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const tagsByRecipe = new Map<string, string[]>();
  for (const link of tagLinks) {
    const list = tagsByRecipe.get(link.recipeId) || [];
    list.push(link.tagName);
    tagsByRecipe.set(link.recipeId, list);
  }

  return recipeRows.map(({ recipe, authorName, authorImage }) => ({
    ...recipe,
    tags: tagsByRecipe.get(recipe.id) || [],
    isOwner: !recipe.userId || (!!userId && recipe.userId === userId),
    authorName: authorName ?? null,
    authorImage: authorImage ?? null,
  }));
}

export async function getRecipe(
  id: string,
  userId?: string,
): Promise<FullRecipe | null> {
  const row = await db
    .select({
      recipe: schema.recipes,
      authorName: schema.user.name,
      authorImage: schema.user.image,
    })
    .from(schema.recipes)
    .leftJoin(schema.user, eq(schema.recipes.userId, schema.user.id))
    .where(eq(schema.recipes.id, id))
    .get();

  if (!row) return null;
  const { recipe, authorName, authorImage } = row;

  const isOwner = !recipe.userId || (!!userId && recipe.userId === userId);
  if (!isOwner && recipe.visibility !== "shared") {
    return null;
  }

  const [ingredientRows, stepRows, tagRows] = await Promise.all([
    db
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.recipeId, id))
      .orderBy(asc(schema.ingredients.order)),
    db
      .select()
      .from(schema.steps)
      .where(eq(schema.steps.recipeId, id))
      .orderBy(asc(schema.steps.order)),
    db
      .select({ name: schema.tags.name })
      .from(schema.recipeTags)
      .innerJoin(schema.tags, eq(schema.recipeTags.tagId, schema.tags.id))
      .where(eq(schema.recipeTags.recipeId, id))
      .orderBy(asc(schema.tags.name)),
  ]);

  return {
    ...recipe,
    ingredients: ingredientRows,
    steps: stepRows,
    tags: tagRows.map((t) => t.name),
    isOwner,
    authorName: authorName ?? null,
    authorImage: authorImage ?? null,
  };
}

export async function getFullRecipes(
  ids?: string[],
  userId?: string,
): Promise<FullRecipe[]> {
  const accessCondition = userId
    ? or(
        eq(schema.recipes.visibility, "shared"),
        eq(schema.recipes.userId, userId),
        isNull(schema.recipes.userId),
      )
    : eq(schema.recipes.visibility, "shared");

  const whereCondition =
    ids && ids.length > 0
      ? and(inArray(schema.recipes.id, ids), accessCondition)
      : accessCondition;

  const recipeRows = await db
    .select({
      recipe: schema.recipes,
      authorName: schema.user.name,
      authorImage: schema.user.image,
    })
    .from(schema.recipes)
    .leftJoin(schema.user, eq(schema.recipes.userId, schema.user.id))
    .where(whereCondition)
    .orderBy(desc(schema.recipes.createdAt));

  if (recipeRows.length === 0) return [];

  const foundIds = recipeRows.map((r) => r.recipe.id);

  const [allIngredients, allSteps, allTagLinks] = await Promise.all([
    db
      .select()
      .from(schema.ingredients)
      .where(inArray(schema.ingredients.recipeId, foundIds))
      .orderBy(asc(schema.ingredients.order)),
    db
      .select()
      .from(schema.steps)
      .where(inArray(schema.steps.recipeId, foundIds))
      .orderBy(asc(schema.steps.order)),
    db
      .select({
        recipeId: schema.recipeTags.recipeId,
        name: schema.tags.name,
      })
      .from(schema.recipeTags)
      .innerJoin(schema.tags, eq(schema.recipeTags.tagId, schema.tags.id))
      .where(inArray(schema.recipeTags.recipeId, foundIds))
      .orderBy(asc(schema.tags.name)),
  ]);

  const ingredientsByRecipe = new Map<string, schema.Ingredient[]>();
  for (const ing of allIngredients) {
    const list = ingredientsByRecipe.get(ing.recipeId) || [];
    list.push(ing);
    ingredientsByRecipe.set(ing.recipeId, list);
  }

  const stepsByRecipe = new Map<string, schema.Step[]>();
  for (const step of allSteps) {
    const list = stepsByRecipe.get(step.recipeId) || [];
    list.push(step);
    stepsByRecipe.set(step.recipeId, list);
  }

  const tagsByRecipe = new Map<string, string[]>();
  for (const link of allTagLinks) {
    const list = tagsByRecipe.get(link.recipeId) || [];
    list.push(link.name);
    tagsByRecipe.set(link.recipeId, list);
  }

  return recipeRows.map(({ recipe, authorName, authorImage }) => ({
    ...recipe,
    ingredients: ingredientsByRecipe.get(recipe.id) || [],
    steps: stepsByRecipe.get(recipe.id) || [],
    tags: tagsByRecipe.get(recipe.id) || [],
    isOwner: !recipe.userId || (!!userId && recipe.userId === userId),
    authorName: authorName ?? null,
    authorImage: authorImage ?? null,
  }));
}

function syncRecipeTags(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  recipeId: string,
  rawTags?: string[],
) {
  if (!rawTags || rawTags.length === 0) return;
  const seen = new Set<string>();
  const cleanTags: string[] = [];
  for (const t of rawTags) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      cleanTags.push(trimmed);
    }
  }

  for (const tagName of cleanTags) {
    let tag = tx
      .select()
      .from(schema.tags)
      .where(sql`lower(${schema.tags.name}) = lower(${tagName})`)
      .get();

    if (!tag) {
      const tagId = randomUUID();
      tx.insert(schema.tags)
        .values({
          id: tagId,
          name: tagName,
        })
        .run();
      tag = { id: tagId, name: tagName, createdAt: Math.floor(Date.now() / 1000) };
    }

    tx.insert(schema.recipeTags)
      .values({
        recipeId,
        tagId: tag.id,
      })
      .onConflictDoNothing()
      .run();
  }
}

export async function createRecipe(
  input: RecipeInput,
  userId?: string,
): Promise<string> {
  const [id] = await createRecipesBatch([input], userId);
  return id;
}

export async function updateRecipe(
  id: string,
  input: RecipeInput,
  userId?: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, id))
    .get();

  if (!existing) throw new Error("Recipe not found");
  if (!userId) {
    throw new Error("Unauthorized: User ID required");
  }
  if (existing.userId && existing.userId !== userId) {
    throw new Error("Unauthorized: Only the recipe owner can edit this recipe");
  }

  const now = Math.floor(Date.now() / 1000);

  db.transaction((tx) => {
    tx.update(schema.recipes)
      .set({
        title: input.title,
        description: input.description ?? null,
        servings: input.servings,
        prepTimeMin: input.prepTimeMin ?? null,
        cookTimeMin: input.cookTimeMin ?? null,
        imageUrl: input.imageUrl ?? null,
        calories: input.calories ?? null,
        proteinG: input.proteinG ?? null,
        carbsG: input.carbsG ?? null,
        fatG: input.fatG ?? null,
        fiberG: input.fiberG ?? null,
        visibility: input.visibility ?? existing.visibility,
        isCooked: input.isCooked ?? existing.isCooked,
        updatedAt: now,
      })
      .where(eq(schema.recipes.id, id))
      .run();

    tx.delete(schema.ingredients).where(eq(schema.ingredients.recipeId, id)).run();
    tx.delete(schema.steps).where(eq(schema.steps.recipeId, id)).run();
    tx.delete(schema.recipeTags).where(eq(schema.recipeTags.recipeId, id)).run();

    input.ingredients.forEach((ing, i) => {
      tx.insert(schema.ingredients)
        .values({
          id: randomUUID(),
          recipeId: id,
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          order: i,
        })
        .run();
    });

    input.steps.forEach((text, i) => {
      tx.insert(schema.steps)
        .values({ id: randomUUID(), recipeId: id, order: i, text })
        .run();
    });

    syncRecipeTags(tx, id, input.tags);
  });
}

export async function deleteRecipe(id: string, userId?: string): Promise<void> {
  const existing = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, id))
    .get();

  if (!existing) return;
  if (!userId) {
    throw new Error("Unauthorized: User ID required");
  }
  if (existing.userId && existing.userId !== userId) {
    throw new Error("Unauthorized: Only the recipe owner can delete this recipe");
  }

  db.delete(schema.recipes).where(eq(schema.recipes.id, id)).run();
}

export async function updateImage(
  id: string,
  imageUrl: string,
  userId?: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, id))
    .get();

  if (!existing) throw new Error("Recipe not found");
  if (!userId) {
    throw new Error("Unauthorized: User ID required");
  }
  if (existing.userId && existing.userId !== userId) {
    throw new Error("Unauthorized: Only the recipe owner can update the image");
  }

  const now = Math.floor(Date.now() / 1000);
  db.update(schema.recipes)
    .set({ imageUrl, updatedAt: now })
    .where(eq(schema.recipes.id, id))
    .run();
}

export async function forkRecipe(
  id: string,
  userId: string,
): Promise<string> {
  const recipe = await getRecipe(id, userId);
  if (!recipe) throw new Error("Recipe not found");

  const newId = await createRecipe(
    {
      sourceType: recipe.sourceType,
      sourceUrl: recipe.sourceUrl,
      language: recipe.language,
      title: `${recipe.title}`,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      imageUrl: recipe.imageUrl,
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG: recipe.carbsG,
      fatG: recipe.fatG,
      fiberG: recipe.fiberG,
      ingredients: recipe.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      steps: recipe.steps.map((s) => s.text),
      tags: recipe.tags,
      visibility: "shared",
      isCooked: recipe.isCooked,
    },
    userId,
  );

  return newId;
}

export async function createRecipesBatch(
  inputs: RecipeInput[],
  userId?: string,
): Promise<string[]> {
  const ids: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  db.transaction((tx) => {
    for (const input of inputs) {
      const id = randomUUID();
      ids.push(id);

      tx.insert(schema.recipes).values({
        id,
        userId: userId ?? null,
        visibility: input.visibility ?? "shared",
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl ?? null,
        language: input.language,
        title: input.title,
        description: input.description ?? null,
        servings: input.servings,
        prepTimeMin: input.prepTimeMin ?? null,
        cookTimeMin: input.cookTimeMin ?? null,
        imageUrl: input.imageUrl ?? null,
        calories: input.calories ?? null,
        proteinG: input.proteinG ?? null,
        carbsG: input.carbsG ?? null,
        fatG: input.fatG ?? null,
        fiberG: input.fiberG ?? null,
        isCooked: input.isCooked ?? false,
        createdAt: now,
        updatedAt: now,
      }).run();

      input.ingredients.forEach((ing, i) => {
        tx.insert(schema.ingredients)
          .values({
            id: randomUUID(),
            recipeId: id,
            name: ing.name,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
            order: i,
          })
          .run();
      });

      input.steps.forEach((text, i) => {
        tx.insert(schema.steps)
          .values({
            id: randomUUID(),
            recipeId: id,
            order: i,
            text,
          })
          .run();
      });

      syncRecipeTags(tx, id, input.tags);
    }
  });

  return ids;
}

export async function listAllTags(): Promise<string[]> {
  const rows = await db
    .select({ name: schema.tags.name })
    .from(schema.tags)
    .orderBy(asc(schema.tags.name));
  return rows.map((r) => r.name);
}

export async function toggleRecipeCooked(
  id: string,
  userId?: string,
  forceState?: boolean,
): Promise<{ isCooked: boolean }> {
  const existing = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, id))
    .get();

  if (!existing) throw new Error("Recipe not found");

  const isOwner = !existing.userId || (!!userId && existing.userId === userId);
  if (!isOwner && existing.visibility !== "shared") {
    throw new Error("Unauthorized: You do not have access to this recipe");
  }

  const newState = forceState !== undefined ? forceState : !existing.isCooked;
  const now = Math.floor(Date.now() / 1000);

  db.update(schema.recipes)
    .set({ isCooked: newState, updatedAt: now })
    .where(eq(schema.recipes.id, id))
    .run();

  return { isCooked: newState };
}


