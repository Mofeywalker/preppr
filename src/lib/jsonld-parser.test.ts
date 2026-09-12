import { describe, it, expect } from "vitest";
import {
  parseDurationToMinutes,
  parseServings,
  parseIngredientLine,
  extractInstructions,
  extractNutrition,
  parseJsonLdRecipe,
} from "./jsonld-parser";

describe("jsonld-parser", () => {
  describe("parseDurationToMinutes", () => {
    it("handles numeric minutes directly", () => {
      expect(parseDurationToMinutes(30)).toBe(30);
      expect(parseDurationToMinutes(45.6)).toBe(46);
    });

    it("parses ISO 8601 duration strings", () => {
      expect(parseDurationToMinutes("PT30M")).toBe(30);
      expect(parseDurationToMinutes("PT1H15M")).toBe(75);
      expect(parseDurationToMinutes("PT2H")).toBe(120);
      expect(parseDurationToMinutes("P0DT0H45M")).toBe(45);
      expect(parseDurationToMinutes("P1DT2H")).toBe(1560); // 1440 + 120
    });

    it("parses textual durations in German and English", () => {
      expect(parseDurationToMinutes("45 Min.")).toBe(45);
      expect(parseDurationToMinutes("1 Std. 30 Min.")).toBe(90);
      expect(parseDurationToMinutes("2 Stunden")).toBe(120);
      expect(parseDurationToMinutes("1 hour 15 mins")).toBe(75);
    });

    it("falls back to pure digits", () => {
      expect(parseDurationToMinutes("25")).toBe(25);
    });

    it("returns null for invalid or empty inputs", () => {
      expect(parseDurationToMinutes("")).toBeNull();
      expect(parseDurationToMinutes("unknown time")).toBeNull();
      expect(parseDurationToMinutes(null)).toBeNull();
      expect(parseDurationToMinutes(undefined)).toBeNull();
    });
  });

  describe("parseServings", () => {
    it("returns number when valid integer within range 1-100", () => {
      expect(parseServings(4)).toBe(4);
      expect(parseServings(1)).toBe(1);
      expect(parseServings(50)).toBe(50);
    });

    it("extracts servings from strings and arrays", () => {
      expect(parseServings("4 Portionen")).toBe(4);
      expect(parseServings("Serves 6 people")).toBe(6);
      expect(parseServings(["8 servings"])).toBe(8);
    });

    it("defaults to 4 if out of bounds or unparseable", () => {
      expect(parseServings("invalid")).toBe(4);
      expect(parseServings(0)).toBe(4);
      expect(parseServings(150)).toBe(4);
      expect(parseServings(null)).toBe(4);
    });
  });

  describe("parseIngredientLine", () => {
    it("parses basic ingredient with amount, unit and name", () => {
      const res = parseIngredientLine("250 g Mehl");
      expect(res.quantity).toBe(250);
      expect(res.unit).toBe("g");
      expect(res.name).toBe("Mehl");
    });

    it("normalizes German and English units", () => {
      expect(parseIngredientLine("2 EL Olivenöl")).toEqual({
        quantity: 2,
        unit: "EL",
        name: "Olivenöl",
      });
      expect(parseIngredientLine("1 teelöffel Salz")).toEqual({
        quantity: 1,
        unit: "TL",
        name: "Salz",
      });
      expect(parseIngredientLine("500 ml Milch")).toEqual({
        quantity: 500,
        unit: "ml",
        name: "Milch",
      });
      expect(parseIngredientLine("1 tbsp olive oil")).toEqual({
        quantity: 1,
        unit: "EL",
        name: "olive oil",
      });
    });

    it("parses unicode fractions and ascii fractions", () => {
      expect(parseIngredientLine("½ TL Pfeffer")).toEqual({
        quantity: 0.5,
        unit: "TL",
        name: "Pfeffer",
      });
      expect(parseIngredientLine("1 1/2 Tassen Mehl")).toEqual({
        quantity: 1.5,
        unit: "Tasse",
        name: "Mehl",
      });
    });

    it("handles ingredient without amount or unit", () => {
      const res = parseIngredientLine("Salz und frisch gemahlener Pfeffer");
      expect(res.quantity).toBeNull();
      expect(res.unit).toBeNull();
      expect(res.name).toBe("Salz und frisch gemahlener Pfeffer");
    });

    it("strips bullet points and HTML tags", () => {
      const res = parseIngredientLine("- <b>2</b> EL Butter");
      expect(res.quantity).toBe(2);
      expect(res.unit).toBe("EL");
      expect(res.name).toBe("Butter");
    });
  });

  describe("extractInstructions", () => {
    it("parses array of strings", () => {
      const steps = ["Den Ofen auf 180 Grad vorheizen.", "Teig kneten."];
      expect(extractInstructions(steps)).toEqual(steps);
    });

    it("parses Schema.org HowToStep objects", () => {
      const input = [
        { "@type": "HowToStep", text: "Zwiebeln würfeln." },
        { "@type": "HowToStep", text: "In der Pfanne anbraten." },
      ];
      expect(extractInstructions(input)).toEqual([
        "Zwiebeln würfeln.",
        "In der Pfanne anbraten.",
      ]);
    });

    it("parses Schema.org HowToSection with nested steps", () => {
      const input = [
        {
          "@type": "HowToSection",
          name: "Vorbereitung",
          itemListElement: [
            { "@type": "HowToStep", text: "Schritt 1" },
            { "@type": "HowToStep", text: "Schritt 2" },
          ],
        },
      ];
      expect(extractInstructions(input)).toEqual(["Schritt 1", "Schritt 2"]);
    });

    it("splits long single multiline instruction text", () => {
      const input = "1. Zwiebeln anbraten.\n2. Tomaten dazugeben.\n3. Köcheln lassen.";
      expect(extractInstructions(input)).toEqual([
        "Zwiebeln anbraten.",
        "Tomaten dazugeben.",
        "Köcheln lassen.",
      ]);
    });
  });

  describe("extractNutrition", () => {
    it("extracts nutrients from Schema.org NutritionInformation", () => {
      const raw = {
        calories: "450 kcal",
        proteinContent: "25 g",
        carbohydrateContent: "50g",
        fatContent: "15 grams",
      };
      const nut = extractNutrition(raw);
      expect(nut.calories).toBe(450);
      expect(nut.proteinG).toBe(25);
      expect(nut.carbsG).toBe(50);
      expect(nut.fatG).toBe(15);
    });

    it("returns zeroed nutrition with null fiber if nutrition object is null or empty", () => {
      expect(extractNutrition(null)).toEqual({
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: null,
      });
      expect(extractNutrition({})).toEqual({
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: null,
      });
    });
  });

  describe("parseJsonLdRecipe", () => {
    it("extracts a complete recipe correctly", () => {
      const jsonLd = {
        name: "Spaghetti Bolognese",
        description: "Ein klassisches italienisches Pasta-Gericht.",
        recipeYield: "4 Portionen",
        prepTime: "PT15M",
        cookTime: "PT45M",
        recipeIngredient: ["400 g Spaghetti", "500 g Rinderhackfleisch", "1 Dose Tomaten"],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Wasser zum Kochen bringen." },
          { "@type": "HowToStep", text: "Hackfleisch anbraten." },
        ],
        nutrition: {
          calories: "620 kcal",
        },
        inLanguage: "de-DE",
      };

      const result = parseJsonLdRecipe(jsonLd);
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Spaghetti Bolognese");
      expect(result?.description).toBe("Ein klassisches italienisches Pasta-Gericht.");
      expect(result?.servings).toBe(4);
      expect(result?.prepTimeMin).toBe(15);
      expect(result?.cookTimeMin).toBe(45);
      expect(result?.language).toBe("de");
      expect(result?.ingredients).toHaveLength(3);
      expect(result?.ingredients[0]).toEqual({
        quantity: 400,
        unit: "g",
        name: "Spaghetti",
      });
      expect(result?.steps).toEqual([
        "Wasser zum Kochen bringen.",
        "Hackfleisch anbraten.",
      ]);
      expect(result?.nutrition?.calories).toBe(620);
    });

    it("returns null if required fields like title, ingredients or steps are missing", () => {
      expect(parseJsonLdRecipe({ name: "Ohne Zutaten" })).toBeNull();
      expect(
        parseJsonLdRecipe({
          name: "Ohne Schritte",
          recipeIngredient: ["1 Ei"],
        })
      ).toBeNull();
    });
  });
});
