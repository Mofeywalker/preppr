import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlinkSync } from "node:fs";

const testDbPath = join(tmpdir(), `preppr-test-${Date.now()}.db`);
process.env.DATABASE_PATH = testDbPath;

// Dynamic import so DATABASE_PATH is applied when DB client initializes
const { db, schema } = await import("@/db/client");
const {
  createRecipe,
  getRecipe,
  updateRecipe,
  deleteRecipe,
  forkRecipe,
  listAllTags,
} = await import("./recipes");

describe("recipe database operations", () => {
  const userId = "test-user-1";
  const forkedUserId = "user-forker";

  beforeAll(async () => {
    // Insert test users required for recipes foreign key constraint
    await db.insert(schema.user).values([
      {
        id: userId,
        name: "Test User 1",
        email: "test1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: forkedUserId,
        name: "Forker User",
        email: "forker@example.com",
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

  it("creates a recipe with ingredients, steps, and tags", async () => {
    const id = await createRecipe(
      {
        sourceType: "manual",
        language: "de",
        title: "Käsespätzle",
        description: "Schwäbischer Klassiker",
        servings: 4,
        prepTimeMin: 20,
        cookTimeMin: 15,
        ingredients: [
          { name: "Spätzlemehl", quantity: 400, unit: "g" },
          { name: "Eier", quantity: 4, unit: "Stk" },
          { name: "Bergkäse", quantity: 200, unit: "g" },
        ],
        steps: ["Teig schlagen, bis er Blasen wirft.", "Spätzle ins kochende Wasser schaben.", "Mit Käse schichten."],
        tags: ["Schwäbisch", "Vegetarisch"],
      },
      userId,
    );

    expect(id).toBeDefined();

    const recipe = await getRecipe(id, userId);
    expect(recipe).not.toBeNull();
    expect(recipe?.title).toBe("Käsespätzle");
    expect(recipe?.servings).toBe(4);
    expect(recipe?.ingredients).toHaveLength(3);
    expect(recipe?.steps).toHaveLength(3);
    expect(recipe?.tags).toEqual(["Schwäbisch", "Vegetarisch"]);
  });

  it("updates an existing recipe", async () => {
    const id = await createRecipe(
      {
        sourceType: "manual",
        language: "de",
        title: "Pizza Margherita",
        servings: 2,
        ingredients: [{ name: "Pizzateig", quantity: 1, unit: "Pck" }],
        steps: ["Belegen und backen."],
        tags: ["Italienisch"],
      },
      userId,
    );

    await updateRecipe(
      id,
      {
        sourceType: "manual",
        language: "de",
        title: "Pizza Funghi",
        description: "Mit frischen Champignons",
        servings: 3,
        ingredients: [
          { name: "Pizzateig", quantity: 1, unit: "Pck" },
          { name: "Champignons", quantity: 150, unit: "g" },
        ],
        steps: ["Pilze schneiden.", "Belegen und backen."],
        tags: ["Italienisch", "Pilze"],
      },
      userId,
    );

    const updated = await getRecipe(id, userId);
    expect(updated?.title).toBe("Pizza Funghi");
    expect(updated?.description).toBe("Mit frischen Champignons");
    expect(updated?.servings).toBe(3);
    expect(updated?.ingredients).toHaveLength(2);
    expect(updated?.steps).toHaveLength(2);
    expect(updated?.tags).toEqual(["Italienisch", "Pilze"]);
  });

  it("fails to update if caller is not the owner", async () => {
    const id = await createRecipe(
      {
        sourceType: "manual",
        language: "de",
        title: "Privates Rezept",
        servings: 1,
        ingredients: [{ name: "Zutat", quantity: 1, unit: "g" }],
        steps: ["Schritt 1"],
      },
      userId,
    );

    await expect(
      updateRecipe(
        id,
        {
          sourceType: "manual",
          language: "de",
          title: "Hacked Title",
          servings: 1,
          ingredients: [],
          steps: [],
        },
        "different-user",
      ),
    ).rejects.toThrow("Unauthorized: Only the recipe owner can edit this recipe");
  });

  it("forks a recipe for another user", async () => {
    const originalId = await createRecipe(
      {
        sourceType: "manual",
        language: "de",
        title: "Original Pancakes",
        servings: 2,
        ingredients: [{ name: "Mehl", quantity: 200, unit: "g" }],
        steps: ["In der Pfanne backen."],
        tags: ["Frühstück"],
      },
      userId,
    );

    const forkedId = await forkRecipe(originalId, forkedUserId);
    expect(forkedId).not.toBe(originalId);

    const forked = await getRecipe(forkedId, forkedUserId);
    expect(forked).not.toBeNull();
    expect(forked?.title).toBe("Original Pancakes");
    expect(forked?.userId).toBe(forkedUserId);
    expect(forked?.ingredients).toHaveLength(1);
    expect(forked?.tags).toEqual(["Frühstück"]);
  });

  it("lists all tags across recipes", async () => {
    const tags = await listAllTags();
    expect(tags).toContain("Schwäbisch");
    expect(tags).toContain("Vegetarisch");
    expect(tags).toContain("Italienisch");
  });

  it("deletes a recipe and cascaded relations", async () => {
    const id = await createRecipe(
      {
        sourceType: "manual",
        language: "de",
        title: "Kurzlebiges Rezept",
        servings: 1,
        ingredients: [{ name: "Wasser", quantity: 1, unit: "l" }],
        steps: ["Kochen."],
      },
      userId,
    );

    await deleteRecipe(id, userId);

    const deleted = await getRecipe(id, userId);
    expect(deleted).toBeNull();
  });
});
