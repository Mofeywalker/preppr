import { describe, it, expect } from "vitest";
import { formatRecipeText, RecipeShareDialog } from "./recipe-share-dialog";
import type { FullRecipe } from "@/lib/recipes";

describe("RecipeShareDialog and formatRecipeText", () => {
  it("exports RecipeShareDialog component", () => {
    expect(RecipeShareDialog).toBeDefined();
    expect(typeof RecipeShareDialog).toBe("function");
  });

  const mockRecipe: FullRecipe = {
    id: "rec-123",
    userId: "user-1",
    visibility: "shared",
    sourceType: "manual",
    sourceUrl: null,
    language: "de",
    title: "Kichererbsen Curry",
    description: "Cremiges, aromatisches Curry",
    servings: 4,
    prepTimeMin: 15,
    cookTimeMin: 25,
    imageUrl: "/uploads/curry.jpg",
    calories: 450,
    proteinG: 18,
    carbsG: 55,
    fatG: 14,
    fiberG: 8,
    isCooked: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ingredients: [
      { id: "ing-1", recipeId: "rec-123", name: "Kichererbsen", quantity: 400, unit: "g", order: 0 },
      { id: "ing-2", recipeId: "rec-123", name: "Kokosmilch", quantity: 400, unit: "ml", order: 1 },
      { id: "ing-3", recipeId: "rec-123", name: "Salz", quantity: null, unit: null, order: 2 },
    ],
    steps: [
      { id: "step-1", recipeId: "rec-123", order: 0, text: "Zwiebeln anbraten" },
      { id: "step-2", recipeId: "rec-123", order: 1, text: "Kokosmilch & Kichererbsen hinzugeben und köcheln lassen" },
    ],
    tags: ["curry", "vegan"],
    isOwner: true,
    authorName: "Chef",
    authorImage: null,
  };

  it("formats recipe text correctly with 4 servings", () => {
    const text = formatRecipeText(mockRecipe, 4);

    expect(text).toContain("🍳 *Kichererbsen Curry*");
    expect(text).toContain("Cremiges, aromatisches Curry");
    expect(text).toContain("👥 4 Portionen");
    expect(text).toContain("⏱️ 40 Min.");
    expect(text).toContain("⚡ 450 kcal");
    expect(text).toContain("*Zutaten:*");
    expect(text).toContain("• Kichererbsen (400 g)");
    expect(text).toContain("• Kokosmilch (400 ml)");
    expect(text).toContain("• Salz");
    expect(text).toContain("*Zubereitung:*");
    expect(text).toContain("1. Zwiebeln anbraten");
    expect(text).toContain("2. Kokosmilch & Kichererbsen hinzugeben und köcheln lassen");
    expect(text).toContain("Gekocht mit preppr 💚");
  });

  it("scales ingredient quantities when servings change", () => {
    // 2 servings instead of 4 -> quantities should be halved (200g, 200ml)
    const text = formatRecipeText(mockRecipe, 2);

    expect(text).toContain("👥 2 Portionen");
    expect(text).toContain("• Kichererbsen (200 g)");
    expect(text).toContain("• Kokosmilch (200 ml)");
    expect(text).toContain("• Salz");
  });

  it("handles 1 serving singular label", () => {
    const text = formatRecipeText(mockRecipe, 1);
    expect(text).toContain("👥 1 Portion");
    expect(text).toContain("• Kichererbsen (100 g)");
  });
});
