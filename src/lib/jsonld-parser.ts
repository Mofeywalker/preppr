import type { ExtractedRecipe } from "./ai";
import type { Locale } from "@/i18n/routing";

/**
 * Strips HTML tags from text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses ISO 8601 duration (e.g. PT20M, PT1H30M, P0DT0H45M) or textual minutes.
 */
export function parseDurationToMinutes(duration: unknown): number | null {
  if (typeof duration === "number" && !isNaN(duration)) {
    return Math.round(duration);
  }
  if (typeof duration !== "string" || !duration.trim()) {
    return null;
  }

  const str = duration.trim();

  // Match ISO 8601 duration: P...T...
  const isoMatch = str.match(/P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/i);
  if (isoMatch) {
    const days = parseInt(isoMatch[1] || "0", 10);
    const hours = parseInt(isoMatch[2] || "0", 10);
    const minutes = parseInt(isoMatch[3] || "0", 10);
    const totalMinutes = days * 1440 + hours * 60 + minutes;
    if (totalMinutes > 0) return totalMinutes;
  }

  // Plain text fallback: "1 Std. 20 Min." or "45 Min"
  let total = 0;
  const hoursMatch = str.match(/([0-9]+)\s*(?:h|std|stunde|stunden|hour|hours)/i);
  const minutesMatch = str.match(/([0-9]+)\s*(?:m|min|minute|minuten|minutes)/i);

  if (hoursMatch) total += parseInt(hoursMatch[1], 10) * 60;
  if (minutesMatch) total += parseInt(minutesMatch[1], 10);

  if (total > 0) return total;

  // Pure digits fallback
  const digits = parseInt(str.replace(/[^\d]/g, ""), 10);
  return !isNaN(digits) && digits > 0 && digits < 1000 ? digits : null;
}

/**
 * Parses servings / yield into a clean integer between 1 and 100.
 */
export function parseServings(yieldData: unknown): number {
  if (typeof yieldData === "number" && yieldData >= 1 && yieldData <= 100) {
    return Math.round(yieldData);
  }

  let text = "";
  if (Array.isArray(yieldData) && yieldData.length > 0) {
    text = String(yieldData[0]);
  } else if (typeof yieldData === "string") {
    text = yieldData;
  }

  const match = text.match(/([0-9]+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 100) {
      return num;
    }
  }

  return 4; // Sensible default
}

const FRACTION_MAP: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNIT_NORMALIZATION: Record<string, string> = {
  // German units
  el: "EL",
  esslöffel: "EL",
  tl: "TL",
  teelöffel: "TL",
  kl: "TL",
  kaffeelöffel: "TL",
  g: "g",
  gramm: "g",
  kg: "kg",
  kilo: "kg",
  kilogramm: "kg",
  mg: "mg",
  milligramm: "mg",
  ml: "ml",
  milliliter: "ml",
  l: "l",
  liter: "l",
  dl: "dl",
  deziliter: "dl",
  cl: "cl",
  zentiliter: "cl",
  prise: "Prise",
  prisen: "Prise",
  messerspitze: "Msp.",
  msp: "Msp.",
  "msp.": "Msp.",
  bund: "Bund",
  bündel: "Bund",
  pck: "Pck.",
  "pck.": "Pck.",
  päckchen: "Pck.",
  packung: "Packung",
  packungen: "Packungen",
  pkg: "Pck.",
  "pkg.": "Pck.",
  becher: "Becher",
  glas: "Glas",
  gläser: "Glas",
  dose: "Dose",
  dosen: "Dose",
  zweig: "Zweig",
  zweige: "Zweig",
  stängel: "Stängel",
  stange: "Stange",
  stangen: "Stange",
  scheibe: "Scheibe",
  scheiben: "Scheibe",
  blatt: "Blatt",
  blätter: "Blatt",
  stück: "Stk.",
  stk: "Stk.",
  "stk.": "Stk.",
  zehe: "Zehe",
  zehen: "Zehe",
  knolle: "Knolle",
  knollen: "Knolle",
  spritzer: "Spritzer",
  schuss: "Schuss",
  tropfen: "Tropfen",
  handvoll: "Handvoll",
  tasse: "Tasse",
  tassen: "Tasse",
  // English units
  tbsp: "EL",
  tablespoon: "EL",
  tablespoons: "EL",
  tsp: "TL",
  teaspoon: "TL",
  teaspoons: "TL",
  cup: "cup",
  cups: "cup",
  pinch: "Pinch",
  clove: "Clove",
  cloves: "Clove",
  can: "Can",
  cans: "Can",
  slice: "Slice",
  slices: "Slice",
};

// Sorted by length descending so multi-word or longer words match before abbreviations (e.g. Esslöffel before el)
const KNOWN_UNITS = Object.keys(UNIT_NORMALIZATION).sort((a, b) => b.length - a.length);

/**
 * Parses a single ingredient text line into quantity, unit, and name.
 */
export function parseIngredientLine(rawLine: string): {
  name: string;
  quantity: number | null;
  unit: string | null;
} {
  let text = stripHtml(rawLine).trim();
  // Remove leading bullet points or dashes
  text = text.replace(/^[-*•–—]\s*/, "");

  // Replace unicode fractions with spaced ascii fractions
  for (const [unicodeChar, decimal] of Object.entries(FRACTION_MAP)) {
    if (text.includes(unicodeChar)) {
      text = text.replace(new RegExp(unicodeChar, "g"), ` ${decimal} `);
    }
  }
  text = text.replace(/\s+/g, " ").trim();

  let quantity: number | null = null;
  let remaining = text;

  // 1. Check for mixed fraction: e.g. "1 1/2" or "2 1/4"
  const mixedFractionMatch = remaining.match(/^(\d+)\s+(\d+)\/(\d+)\s*/);
  if (mixedFractionMatch) {
    const whole = parseFloat(mixedFractionMatch[1]);
    const num = parseFloat(mixedFractionMatch[2]);
    const den = parseFloat(mixedFractionMatch[3]);
    if (den !== 0) {
      quantity = Math.round((whole + num / den) * 100) / 100;
      remaining = remaining.substring(mixedFractionMatch[0].length);
    }
  }

  // 2. Check for simple fraction: e.g. "1/2" or "3/4"
  if (quantity === null) {
    const fractionMatch = remaining.match(/^(\d+)\/(\d+)\s*/);
    if (fractionMatch) {
      const num = parseFloat(fractionMatch[1]);
      const den = parseFloat(fractionMatch[2]);
      if (den !== 0) {
        quantity = Math.round((num / den) * 100) / 100;
        remaining = remaining.substring(fractionMatch[0].length);
      }
    }
  }

  // 3. Check for range: e.g. "1-2" or "1 - 2" (take average)
  if (quantity === null) {
    const rangeMatch = remaining.match(/^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*/);
    if (rangeMatch) {
      const start = parseFloat(rangeMatch[1].replace(",", "."));
      const end = parseFloat(rangeMatch[2].replace(",", "."));
      quantity = Math.round(((start + end) / 2) * 100) / 100;
      remaining = remaining.substring(rangeMatch[0].length);
    }
  }

  // 4. Check for standard decimal or integer: e.g. "500", "1.5", "1,5"
  if (quantity === null) {
    const numberMatch = remaining.match(/^(\d+(?:[.,]\d+)?)\s*/);
    if (numberMatch) {
      quantity = parseFloat(numberMatch[1].replace(",", "."));
      remaining = remaining.substring(numberMatch[0].length);
    }
  }

  // Next, detect unit from the beginning of remaining text
  let unit: string | null = null;
  const trimmedRemaining = remaining.trim();
  const lowerRemaining = trimmedRemaining.toLowerCase();

  for (const knownUnit of KNOWN_UNITS) {
    // Check if word starts with unit followed by non-alpha character or space
    const regex = new RegExp(`^${knownUnit}(?:\\.|\\b)`, "i");
    const unitMatch = lowerRemaining.match(regex);
    if (unitMatch) {
      unit = UNIT_NORMALIZATION[knownUnit] || knownUnit;
      remaining = trimmedRemaining.substring(unitMatch[0].length).trim();
      break;
    }
  }

  // Handle common German compound like "Knoblauchzehe(n)"
  if (!unit && lowerRemaining.startsWith("knoblauchzehe")) {
    unit = "Zehe";
    remaining = "Knoblauch";
  }

  // Clean up remaining ingredient name
  let name = remaining
    .replace(/^[,\s-]+/, "") // remove leading commas or spaces
    .replace(/^von\s+/i, "") // e.g. "EL von Olivenöl"
    .replace(/^of\s+/i, "")
    .trim();

  // If quantity or unit parsing left name empty, fall back to entire clean line
  if (!name) {
    name = text;
    quantity = null;
    unit = null;
  }

  return {
    name,
    quantity,
    unit,
  };
}

/**
 * Extracts clean step instructions from Schema.org recipeInstructions.
 */
export function extractInstructions(instructions: unknown): string[] {
  const steps: string[] = [];

  function addStep(text: string) {
    const cleaned = stripHtml(text).trim();
    if (cleaned.length >= 5) {
      steps.push(cleaned);
    }
  }

  if (typeof instructions === "string") {
    // Single string: split by line breaks or numbered lists
    const lines = instructions.split(/\r?\n|\n\n+/);
    for (const line of lines) {
      addStep(line.replace(/^\d+[\.\)]\s*/, ""));
    }
    return steps;
  }

  if (Array.isArray(instructions)) {
    for (const item of instructions) {
      if (typeof item === "string") {
        addStep(item);
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const type = obj["@type"];

        if (type === "HowToSection" || Array.isArray(obj.itemListElement)) {
          const elements = Array.isArray(obj.itemListElement) ? obj.itemListElement : [];
          for (const subItem of elements) {
            if (typeof subItem === "string") {
              addStep(subItem);
            } else if (subItem && typeof subItem === "object") {
              const subObj = subItem as Record<string, unknown>;
              const text =
                typeof subObj.text === "string"
                  ? subObj.text
                  : typeof subObj.name === "string"
                    ? subObj.name
                    : "";
              if (text) {
                addStep(text);
              }
            }
          }
        } else if (type === "HowToStep" || typeof obj.text === "string" || typeof obj.name === "string") {
          const text = typeof obj.text === "string" ? obj.text : typeof obj.name === "string" ? obj.name : "";
          if (text) addStep(text);
        }
      }
    }
  }

  return steps;
}

/**
 * Extracts nutrition data from Schema.org nutrition object.
 */
export function extractNutrition(nutritionObj: unknown): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
} {
  const parseVal = (val: unknown): number => {
    if (typeof val === "number" && !isNaN(val)) return Math.round(val);
    if (typeof val === "string") {
      const match = val.replace(",", ".").match(/([0-9]+(?:\.[0-9]+)?)/);
      if (match) return Math.round(parseFloat(match[1]));
    }
    return 0;
  };

  const parseNullable = (val: unknown): number | null => {
    const parsed = parseVal(val);
    return parsed > 0 ? parsed : null;
  };

  if (!nutritionObj || typeof nutritionObj !== "object") {
    return {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: null,
    };
  }

  const n = nutritionObj as Record<string, unknown>;

  return {
    calories: parseVal(n.calories),
    proteinG: parseVal(n.proteinContent),
    carbsG: parseVal(n.carbohydrateContent),
    fatG: parseVal(n.fatContent),
    fiberG: parseNullable(n.fiberContent),
  };
}

/**
 * Attempts to parse a Schema.org Recipe JSON-LD object into an ExtractedRecipe.
 * Returns null if the JSON-LD is missing required information (signaling to fall back to Gemini).
 */
export function parseJsonLdRecipe(
  jsonLd: Record<string, unknown>,
  fallbackLocale: Locale = "de",
): ExtractedRecipe | null {
  try {
    // 1. Title
    const title = typeof jsonLd.name === "string" ? stripHtml(jsonLd.name) : "";
    if (!title || title.length < 2) {
      return null;
    }

    // 2. Ingredients
    const rawIngredients = Array.isArray(jsonLd.recipeIngredient)
      ? jsonLd.recipeIngredient
      : Array.isArray(jsonLd.ingredients)
        ? jsonLd.ingredients
        : [];

    const ingredients: { name: string; quantity: number | null; unit: string | null }[] = [];
    for (const raw of rawIngredients) {
      if (typeof raw === "string" && raw.trim()) {
        ingredients.push(parseIngredientLine(raw));
      }
    }

    if (ingredients.length === 0) {
      return null;
    }

    // 3. Steps
    const steps = extractInstructions(jsonLd.recipeInstructions);
    if (steps.length === 0) {
      return null;
    }

    // 4. Description
    const description =
      typeof jsonLd.description === "string" && jsonLd.description.trim()
        ? stripHtml(jsonLd.description)
        : null;

    // 5. Servings
    const servings = parseServings(jsonLd.recipeYield);

    // 6. Times
    const prepTimeMin = parseDurationToMinutes(jsonLd.prepTime);
    let cookTimeMin = parseDurationToMinutes(jsonLd.cookTime);

    // If cookTime is missing but totalTime is present, calculate cookTime = totalTime - prepTime
    if (cookTimeMin === null && jsonLd.totalTime) {
      const totalTimeMin = parseDurationToMinutes(jsonLd.totalTime);
      if (totalTimeMin !== null && prepTimeMin !== null && totalTimeMin >= prepTimeMin) {
        cookTimeMin = totalTimeMin - prepTimeMin;
      } else if (totalTimeMin !== null && prepTimeMin === null) {
        cookTimeMin = totalTimeMin;
      }
    }

    // 7. Nutrition
    const nutrition = extractNutrition(jsonLd.nutrition);

    // 8. Language
    let language: "de" | "en" = fallbackLocale;
    if (typeof jsonLd.inLanguage === "string") {
      const langLower = jsonLd.inLanguage.toLowerCase();
      if (langLower.startsWith("en")) language = "en";
      else if (langLower.startsWith("de")) language = "de";
    }

    return {
      title,
      description,
      language,
      servings,
      prepTimeMin,
      cookTimeMin,
      ingredients,
      steps,
      nutrition,
    };
  } catch (err) {
    console.warn("Direct JSON-LD parsing encountered error, falling back:", err);
    return null;
  }
}
