import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export type RecipeInput = {
  sourceType: "manual" | "youtube" | "tandoor";
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
};

export type Recipe = schema.Recipe;
export type FullRecipe = schema.Recipe & {
  ingredients: schema.Ingredient[];
  steps: schema.Step[];
};

export async function listRecipes(): Promise<schema.Recipe[]> {
  return db
    .select()
    .from(schema.recipes)
    .orderBy(desc(schema.recipes.createdAt));
}

export async function getRecipe(id: string): Promise<FullRecipe | null> {
  const recipe = await db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.id, id))
    .get();
  if (!recipe) return null;

  const [ingredientRows, stepRows] = await Promise.all([
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
  ]);

  return { ...recipe, ingredients: ingredientRows, steps: stepRows };
}

export async function createRecipe(input: RecipeInput): Promise<string> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.transaction((tx) => {
    tx.insert(schema.recipes).values({
      id,
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
  });

  return id;
}

export async function updateRecipe(
  id: string,
  input: RecipeInput,
): Promise<void> {
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
        updatedAt: now,
      })
      .where(eq(schema.recipes.id, id))
      .run();

    tx.delete(schema.ingredients).where(eq(schema.ingredients.recipeId, id)).run();
    tx.delete(schema.steps).where(eq(schema.steps.recipeId, id)).run();

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
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  db.delete(schema.recipes).where(eq(schema.recipes.id, id)).run();
}

export async function updateImage(id: string, imageUrl: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  db.update(schema.recipes)
    .set({ imageUrl, updatedAt: now })
    .where(eq(schema.recipes.id, id))
    .run();
}

export async function createRecipesBatch(inputs: RecipeInput[]): Promise<string[]> {
  const ids: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  db.transaction((tx) => {
    for (const input of inputs) {
      const id = randomUUID();
      ids.push(id);

      tx.insert(schema.recipes).values({
        id,
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
    }
  });

  return ids;
}

