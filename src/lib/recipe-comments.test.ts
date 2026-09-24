import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlinkSync } from "node:fs";

const testDbPath = join(tmpdir(), `preppr-comments-test-${Date.now()}.db`);
process.env.DATABASE_PATH = testDbPath;

// Dynamic imports apply the temporary DATABASE_PATH before the shared DB client initializes.
const { db, schema } = await import("@/db/client");
const { createRecipe, deleteRecipe, getRecipe } = await import("./recipes");
const {
  commentInputSchema,
  createRecipeComment,
  deleteRecipeComment,
  getRecipeComment,
  listRecipeComments,
  updateRecipeComment,
} = await import("./recipe-comments");

describe("recipe comments", () => {
  const ownerId = "comment-owner";
  const commenterId = "comment-writer";

  beforeAll(async () => {
    await db.insert(schema.user).values([
      {
        id: ownerId,
        name: "Recipe Owner",
        email: "comment-owner@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: commenterId,
        name: "Comment Writer",
        email: "comment-writer@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(() => {
    try {
      unlinkSync(testDbPath);
      unlinkSync(`${testDbPath}-shm`);
      unlinkSync(`${testDbPath}-wal`);
    } catch {
      // ignore cleanup errors
    }
  });

  it("validates length, orders joined authors, scopes mutations, and cascades deletion", async () => {
    expect(commentInputSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(commentInputSchema.safeParse({ body: "x".repeat(1001) }).success).toBe(false);
    expect(commentInputSchema.safeParse({ body: "x".repeat(1000) }).success).toBe(true);
    expect(commentInputSchema.parse({ body: "  Try zucchini  " }).body).toBe("Try zucchini");

    const recipeId = await createRecipe(
      {
        sourceType: "manual",
        language: "en",
        title: "Roasted carrots",
        servings: 2,
        ingredients: [{ name: "Carrots", quantity: 4, unit: "" }],
        steps: ["Roast until tender."],
      },
      ownerId,
    );
    const secondRecipeId = await createRecipe(
      {
        sourceType: "manual",
        language: "en",
        title: "Second recipe",
        servings: 1,
        ingredients: [{ name: "Rice", quantity: 1, unit: "cup" }],
        steps: ["Cook rice."],
      },
      ownerId,
    );

    const first = await createRecipeComment(recipeId, commenterId, "Try zucchini");
    const second = await createRecipeComment(recipeId, ownerId, "Add fresh herbs");
    await db
      .update(schema.recipeComments)
      .set({ createdAt: new Date("2024-01-01T00:00:00.000Z") })
      .where(eq(schema.recipeComments.id, first.id));
    await db
      .update(schema.recipeComments)
      .set({ createdAt: new Date("2024-01-02T00:00:00.000Z") })
      .where(eq(schema.recipeComments.id, second.id));

    const listed = await listRecipeComments(recipeId);
    expect(listed.map(({ body }) => body)).toEqual(["Try zucchini", "Add fresh herbs"]);
    expect(listed[0].authorName).toBe("Comment Writer");
    expect(listed[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(await getRecipeComment(secondRecipeId, first.id)).toBeNull();
    expect(await updateRecipeComment(secondRecipeId, first.id, "Wrong recipe")).toBeNull();
    expect(await deleteRecipeComment(secondRecipeId, first.id)).toBe(false);

    const updated = await updateRecipeComment(recipeId, first.id, "Try zucchini and peas");
    expect(updated?.body).toBe("Try zucchini and peas");
    const recipe = await getRecipe(recipeId, ownerId);
    expect(recipe?.ingredients.map(({ name }) => name)).toEqual(["Carrots"]);
    expect(recipe?.steps.map(({ text }) => text)).toEqual(["Roast until tender."]);

    await db
      .delete(schema.user)
      .where(eq(schema.user.id, commenterId));
    expect(await getRecipeComment(recipeId, first.id)).toBeNull();
    expect((await listRecipeComments(recipeId)).map(({ body }) => body)).toEqual([
      "Add fresh herbs",
    ]);

    await deleteRecipe(recipeId, ownerId);
    expect(await listRecipeComments(recipeId)).toEqual([]);
    expect(await getRecipeComment(recipeId, second.id)).toBeNull();
    expect(
      db
        .select()
        .from(schema.recipeComments)
        .where(and(eq(schema.recipeComments.recipeId, recipeId), eq(schema.recipeComments.id, second.id)))
        .get(),
    ).toBeUndefined();
  });
});
