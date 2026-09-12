import { describe, it, expect } from "vitest";
import {
  parseNumber,
  extractNutrition,
  extractIngredientName,
  extractUnit,
  tandoorToRecipeInput,
  type TandoorRecipe,
} from "./tandoor";

describe("tandoor utilities", () => {
  describe("parseNumber", () => {
    it("parses numbers and numeric strings", () => {
      expect(parseNumber(42)).toBe(42);
      expect(parseNumber(3.14)).toBe(3.14);
      expect(parseNumber("100")).toBe(100);
      expect(parseNumber("12,5")).toBe(12.5); // comma decimal
      expect(parseNumber(" -5.2 ")).toBe(-5.2);
    });

    it("returns null for non-numeric or empty values", () => {
      expect(parseNumber(null)).toBeNull();
      expect(parseNumber(undefined)).toBeNull();
      expect(parseNumber("")).toBeNull();
      expect(parseNumber("abc")).toBeNull();
      expect(parseNumber(NaN)).toBeNull();
      expect(parseNumber(Infinity)).toBeNull();
    });
  });

  describe("extractIngredientName", () => {
    it("extracts food name as string", () => {
      expect(extractIngredientName({ food: "Tomaten" })).toBe("Tomaten");
    });

    it("extracts food name from object", () => {
      expect(extractIngredientName({ food: { name: "Zwiebel" } })).toBe("Zwiebel");
      expect(extractIngredientName({ food: { plural_name: "Karotten" } })).toBe("Karotten");
    });

    it("appends note in parentheses if both name and note are present", () => {
      expect(
        extractIngredientName({
          food: "Knoblauch",
          note: "fein gehackt",
        })
      ).toBe("Knoblauch (fein gehackt)");
    });

    it("returns note if food name is missing", () => {
      expect(extractIngredientName({ note: "Salz nach Geschmack" })).toBe("Salz nach Geschmack");
    });
  });

  describe("extractUnit", () => {
    it("extracts unit string or unit object name", () => {
      expect(extractUnit({ unit: "g" })).toBe("g");
      expect(extractUnit({ unit: { name: "EL" } })).toBe("EL");
      expect(extractUnit({ unit: { plural_name: "Stück" } })).toBe("Stück");
      expect(extractUnit({})).toBeNull();
    });
  });

  describe("extractNutrition", () => {
    it("extracts nutrients from explicit nutrition object", () => {
      const nut = {
        calories: "500",
        proteins: "30",
        carbohydrates: "40",
        fats: "15",
        fiber: "8",
      };
      const result = extractNutrition(nut);
      expect(result).toEqual({
        calories: 500,
        proteinG: 30,
        carbsG: 40,
        fatG: 15,
        fiberG: 8,
      });
    });

    it("falls back to null values when empty", () => {
      expect(extractNutrition(null)).toEqual({
        calories: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
      });
    });
  });

  describe("tandoorToRecipeInput", () => {
    it("converts a full TandoorRecipe into RecipeInput", () => {
      const tandoorRecipe: TandoorRecipe = {
        name: "Linsensuppe",
        description: "Deftige Suppe für kalte Tage",
        servings: 4,
        working_time: 20,
        waiting_time: 40,
        steps: [
          {
            order: 1,
            instruction: "Gemüse anbraten.",
            ingredients: [
              {
                food: { name: "Suppengrün" },
                amount: 1,
                unit: { name: "Bund" },
              },
            ],
          },
          {
            order: 2,
            instruction: "Linsen und Brühe hinzugeben und kochen lassen.",
            ingredients: [
              {
                food: { name: "Tellerlinsen" },
                amount: 250,
                unit: { name: "g" },
              },
            ],
          },
        ],
        nutrition: {
          calories: 380,
          proteins: 22,
        },
      };

      const result = tandoorToRecipeInput(tandoorRecipe, "de", {
        sourceUrl: "https://example.com",
      });

      expect(result.title).toBe("Linsensuppe");
      expect(result.description).toBe("Deftige Suppe für kalte Tage");
      expect(result.servings).toBe(4);
      expect(result.prepTimeMin).toBe(20);
      expect(result.cookTimeMin).toBe(40);
      expect(result.sourceUrl).toBe("https://example.com");
      expect(result.ingredients).toEqual([
        { name: "Suppengrün", quantity: 1, unit: "Bund" },
        { name: "Tellerlinsen", quantity: 250, unit: "g" },
      ]);
      expect(result.steps).toEqual([
        "Gemüse anbraten.",
        "Linsen und Brühe hinzugeben und kochen lassen.",
      ]);
      expect(result.calories).toBe(380);
      expect(result.proteinG).toBe(22);
    });

    it("provides defaults when optional fields are absent", () => {
      const minimalRecipe: TandoorRecipe = {
        name: "Einfaches Rezept",
      };
      const result = tandoorToRecipeInput(minimalRecipe, "de");

      expect(result.title).toBe("Einfaches Rezept");
      expect(result.servings).toBe(4);
      expect(result.ingredients.length).toBeGreaterThan(0);
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });
});
