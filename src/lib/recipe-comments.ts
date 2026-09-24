import { randomUUID } from "node:crypto";
import { asc, and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getRecipe, type FullRecipe } from "@/lib/recipes";

export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export type RecipeComment = {
  id: string;
  recipeId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorImage: string | null;
};

type CommentRow = {
  id: string;
  recipeId: string;
  userId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
  authorImage: string | null;
};

function toRecipeComment(row: CommentRow): RecipeComment {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const commentSelection = {
  id: schema.recipeComments.id,
  recipeId: schema.recipeComments.recipeId,
  userId: schema.recipeComments.userId,
  body: schema.recipeComments.body,
  createdAt: schema.recipeComments.createdAt,
  updatedAt: schema.recipeComments.updatedAt,
  authorName: schema.user.name,
  authorImage: schema.user.image,
};

export async function listRecipeComments(
  recipeId: string,
): Promise<RecipeComment[]> {
  const rows = await db
    .select(commentSelection)
    .from(schema.recipeComments)
    .innerJoin(schema.user, eq(schema.recipeComments.userId, schema.user.id))
    .where(eq(schema.recipeComments.recipeId, recipeId))
    .orderBy(asc(schema.recipeComments.createdAt), asc(schema.recipeComments.id));

  return rows.map(toRecipeComment);
}

export async function getRecipeComment(
  recipeId: string,
  commentId: string,
): Promise<RecipeComment | null> {
  const row = await db
    .select(commentSelection)
    .from(schema.recipeComments)
    .innerJoin(schema.user, eq(schema.recipeComments.userId, schema.user.id))
    .where(
      and(
        eq(schema.recipeComments.recipeId, recipeId),
        eq(schema.recipeComments.id, commentId),
      ),
    )
    .get();

  return row ? toRecipeComment(row) : null;
}

export async function createRecipeComment(
  recipeId: string,
  userId: string,
  body: string,
): Promise<RecipeComment> {
  const id = randomUUID();
  const now = new Date();
  db.insert(schema.recipeComments).values({
    id,
    recipeId,
    userId,
    body,
    createdAt: now,
    updatedAt: now,
  }).run();

  const comment = await getRecipeComment(recipeId, id);
  if (!comment) throw new Error("Comment creation failed");
  return comment;
}

export async function updateRecipeComment(
  recipeId: string,
  commentId: string,
  body: string,
): Promise<RecipeComment | null> {
  const updated = db
    .update(schema.recipeComments)
    .set({ body, updatedAt: new Date() })
    .where(
      and(
        eq(schema.recipeComments.recipeId, recipeId),
        eq(schema.recipeComments.id, commentId),
      ),
    )
    .returning({ id: schema.recipeComments.id })
    .get();

  return updated ? getRecipeComment(recipeId, commentId) : null;
}

export async function deleteRecipeComment(
  recipeId: string,
  commentId: string,
): Promise<boolean> {
  const deleted = db
    .delete(schema.recipeComments)
    .where(
      and(
        eq(schema.recipeComments.recipeId, recipeId),
        eq(schema.recipeComments.id, commentId),
      ),
    )
    .returning({ id: schema.recipeComments.id })
    .get();

  return Boolean(deleted);
}

export async function getRecipeForComments(
  recipeId: string,
  userId?: string,
): Promise<FullRecipe | null> {
  const recipe = await getRecipe(recipeId, userId);
  if (!recipe || (recipe.visibility === "private" && !recipe.userId)) return null;
  return recipe;
}
