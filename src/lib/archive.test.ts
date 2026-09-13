import { describe, it, expect } from "vitest";
import { exportRecipesToZip, parsePrepprZip, parseRecipeUpload } from "./archive";
import type { FullRecipe } from "./recipes";

describe("archive utilities", () => {
  const sampleRecipe: FullRecipe = {
    id: "recipe-test-1",
    userId: "user-1",
    title: "Schokoladenkuchen",
    description: "Sehr leckerer Kuchen",
    visibility: "shared",
    sourceType: "manual",
    sourceUrl: "https://example.com/choc",
    imageUrl: null,
    servings: 8,
    prepTimeMin: 20,
    cookTimeMin: 45,
    calories: 450,
    proteinG: 6,
    carbsG: 50,
    fatG: 25,
    fiberG: 3,
    language: "de",
    createdAt: 1735732800,
    updatedAt: 1735732800,
    ingredients: [
      { id: "ing-1", recipeId: "recipe-test-1", name: "Zartbitterschokolade", quantity: 200, unit: "g", order: 1 },
      { id: "ing-2", recipeId: "recipe-test-1", name: "Butter", quantity: 150, unit: "g", order: 2 },
    ],
    steps: [
      { id: "step-1", recipeId: "recipe-test-1", text: "Schokolade schmelzen.", order: 1 },
      { id: "step-2", recipeId: "recipe-test-1", text: "Backen bei 180 Grad.", order: 2 },
    ],
    tags: ["Dessert", "Kuchen"],
    isOwner: true,
  };

  it("exports recipes to a valid ZIP buffer and parses it back", async () => {
    const zipBuffer = await exportRecipesToZip([sampleRecipe]);
    expect(zipBuffer).toBeInstanceOf(Buffer);
    expect(zipBuffer.length).toBeGreaterThan(0);

    const parsedRecipes = await parsePrepprZip(zipBuffer, "de");
    expect(parsedRecipes).toHaveLength(1);

    const imported = parsedRecipes[0];
    expect(imported.title).toBe("Schokoladenkuchen");
    expect(imported.description).toBe("Sehr leckerer Kuchen");
    expect(imported.servings).toBe(8);
    expect(imported.prepTimeMin).toBe(20);
    expect(imported.cookTimeMin).toBe(45);
    expect(imported.sourceUrl).toBe("https://example.com/choc");
    expect(imported.ingredients).toHaveLength(2);
    expect(imported.ingredients[0]).toEqual({
      name: "Zartbitterschokolade",
      quantity: 200,
      unit: "g",
    });
    expect(imported.steps).toEqual([
      "Schokolade schmelzen.",
      "Backen bei 180 Grad.",
    ]);
    expect(imported.tags).toEqual(["Dessert", "Kuchen"]);
    expect(imported.calories).toBe(450);
    expect(imported.proteinG).toBe(6);
    expect(imported.carbsG).toBe(50);
    expect(imported.fatG).toBe(25);
    expect(imported.fiberG).toBe(3);
  });

  it("throws error when ZIP archive contains no recipes.json", async () => {
    const emptyZip = await (await import("jszip")).default().generateAsync({ type: "nodebuffer" });
    await expect(parsePrepprZip(emptyZip, "de")).rejects.toThrow("No recipes.json found in Preppr ZIP archive");
  });

  it("handles alternative fiber property names in JSON", async () => {
    const jsonStr = JSON.stringify([
      { title: "Test 1", ballaststoffe: 5 },
      { title: "Test 2", fiber_g: 4.5 },
      { title: "Test 3", fibre: 3.2 },
      { title: "Test 4", nutrition: { ballaststoffe: 6 } },
    ]);
    const recipes = await parseRecipeUpload(Buffer.from(jsonStr), "recipes.json", "de");
    expect(recipes[0].fiberG).toBe(5);
    expect(recipes[1].fiberG).toBe(4.5);
    expect(recipes[2].fiberG).toBe(3.2);
    expect(recipes[3].fiberG).toBe(6);
  });
});
