import JSZip from "jszip";
import { saveUploadedImage } from "@/lib/storage";
import type { RecipeInput } from "@/lib/recipes";
import type { Locale } from "@/i18n/routing";

export { saveUploadedImage };

export interface TandoorIngredient {
  food?: { name?: string | null; plural_name?: string | null } | string | null;
  unit?: { name?: string | null; plural_name?: string | null; description?: string | null } | string | null;
  amount?: number | string | null;
  note?: string | null;
  is_header?: boolean | null;
  no_amount?: boolean | null;
  name?: string | null;
}

export interface TandoorStep {
  name?: string | null;
  instruction?: string | null;
  order?: number | null;
  time?: number | string | null;
  ingredients?: TandoorIngredient[] | null;
  show_as_header?: boolean | null;
}

export interface TandoorNutrition {
  calories?: number | string | null;
  proteins?: number | string | null;
  carbohydrates?: number | string | null;
  fats?: number | string | null;
  fiber?: number | string | null;
}

export interface TandoorRecipe {
  id?: number | string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  servings?: number | string | null;
  servings_text?: string | null;
  working_time?: number | string | null;
  waiting_time?: number | string | null;
  source_url?: string | null;
  image?: string | null;
  nutrition?: TandoorNutrition | null;
  steps?: TandoorStep[] | null;
  ingredients?: TandoorIngredient[] | null;
  keywords?: Array<{ name: string }> | null;
}

export interface ExtractedTandoorItem {
  recipe: RecipeInput;
  imageBuffer?: Buffer;
  imageExt?: string;
}

export function parseNumber(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === "string") {
    const cleaned = val.trim().replace(",", ".");
    if (!cleaned) return null;
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function extractNutrition(nut?: TandoorNutrition | null): {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
} {
  if (!nut) {
    return {
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
    };
  }

  return {
    calories: parseNumber(nut.calories) ? Math.round(parseNumber(nut.calories)!) : null,
    proteinG: parseNumber(nut.proteins),
    carbsG: parseNumber(nut.carbohydrates),
    fatG: parseNumber(nut.fats),
    fiberG: parseNumber(nut.fiber),
  };
}

export function extractIngredientName(ing: TandoorIngredient): string {
  let name = "";
  if (typeof ing.food === "string" && ing.food.trim()) {
    name = ing.food.trim();
  } else if (ing.food && typeof ing.food === "object") {
    name = (ing.food.name || ing.food.plural_name || "").trim();
  } else if (ing.name && typeof ing.name === "string") {
    name = ing.name.trim();
  }

  const note = (ing.note || "").trim();
  if (name && note) {
    return `${name} (${note})`;
  } else if (!name && note) {
    return note;
  }
  return name;
}

export function extractUnit(ing: TandoorIngredient): string | null {
  if (typeof ing.unit === "string" && ing.unit.trim()) {
    return ing.unit.trim();
  } else if (ing.unit && typeof ing.unit === "object") {
    return (ing.unit.name || ing.unit.plural_name || "").trim() || null;
  }
  return null;
}

export function tandoorToRecipeInput(
  raw: TandoorRecipe,
  locale: Locale = "en",
  options?: { sourceUrl?: string | null; imageUrl?: string | null },
): RecipeInput {
  const title = (raw.name || raw.title || "Tandoor Recipe").trim();
  const description = raw.description?.trim() || null;
  const parsedServings = parseNumber(raw.servings);
  const servings = parsedServings && parsedServings > 0 ? Math.round(parsedServings) : 4;

  const prepTimeMin = parseNumber(raw.working_time);
  const cookTimeMin = parseNumber(raw.waiting_time);
  const nutrition = extractNutrition(raw.nutrition);

  // Extract ingredients from steps and/or root
  const allIngredients: { name: string; quantity?: number | null; unit?: string | null }[] = [];

  const addIngredientItem = (ing: TandoorIngredient) => {
    const name = extractIngredientName(ing);
    if (!name) return;
    const quantity = ing.no_amount ? null : parseNumber(ing.amount);
    const unit = extractUnit(ing);
    allIngredients.push({ name, quantity, unit });
  };

  if (raw.steps && Array.isArray(raw.steps)) {
    for (const step of raw.steps) {
      if (step.ingredients && Array.isArray(step.ingredients)) {
        for (const ing of step.ingredients) {
          addIngredientItem(ing);
        }
      }
    }
  }

  if (raw.ingredients && Array.isArray(raw.ingredients)) {
    for (const ing of raw.ingredients) {
      addIngredientItem(ing);
    }
  }

  // Fallback if no ingredients found
  if (allIngredients.length === 0) {
    allIngredients.push({ name: "1 Ingredient", quantity: null, unit: null });
  }

  // Extract steps
  const steps: string[] = [];
  if (raw.steps && Array.isArray(raw.steps)) {
    // Sort steps by order if present
    const sorted = [...raw.steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const s of sorted) {
      const text = (s.instruction || s.name || "").trim();
      if (text) {
        steps.push(text);
      }
    }
  }

  // Fallback if no steps found
  if (steps.length === 0) {
    steps.push(description || title);
  }

  const resolvedImageUrl =
    options?.imageUrl ??
    (typeof raw.image === "string" && (raw.image.startsWith("http://") || raw.image.startsWith("https://"))
      ? raw.image
      : null);

  const tags: string[] = [];
  if (raw.keywords && Array.isArray(raw.keywords)) {
    for (const kw of raw.keywords) {
      const name = typeof kw === "string" ? kw : (kw as { name?: string })?.name;
      if (name && typeof name === "string" && name.trim()) {
        tags.push(name.trim());
      }
    }
  }

  return {
    sourceType: "tandoor",
    sourceUrl: options?.sourceUrl ?? raw.source_url ?? null,
    language: locale,
    title,
    description,
    servings,
    prepTimeMin: prepTimeMin != null && prepTimeMin > 0 ? Math.round(prepTimeMin) : null,
    cookTimeMin: cookTimeMin != null && cookTimeMin > 0 ? Math.round(cookTimeMin) : null,
    imageUrl: resolvedImageUrl,
    calories: nutrition.calories,
    proteinG: nutrition.proteinG,
    carbsG: nutrition.carbsG,
    fatG: nutrition.fatG,
    fiberG: nutrition.fiberG,
    ingredients: allIngredients,
    steps,
    tags,
  };
}

/**
 * Parses a Tandoor ZIP archive (handles single recipe zip, multi-recipe folder zip, or zip-of-zips).
 */
export async function parseTandoorZip(
  zipBuffer: Buffer | ArrayBuffer,
  locale: Locale = "en",
): Promise<ExtractedTandoorItem[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const results: ExtractedTandoorItem[] = [];

  // Check for nested .zip files first (zip-of-zips pattern common in Tandoor export)
  const nestedZipEntries = Object.keys(zip.files).filter(
    (name) => !zip.files[name].dir && name.toLowerCase().endsWith(".zip"),
  );

  if (nestedZipEntries.length > 0) {
    for (const nestedName of nestedZipEntries) {
      const nestedBuffer = await zip.files[nestedName].async("nodebuffer");
      const nestedItems = await parseTandoorZip(nestedBuffer, locale);
      results.push(...nestedItems);
    }
  }

  // Find all recipe.json files in this zip
  const recipeJsonEntries = Object.keys(zip.files).filter(
    (name) =>
      !zip.files[name].dir &&
      !name.startsWith("__MACOSX/") &&
      (name.toLowerCase() === "recipe.json" || name.toLowerCase().endsWith("/recipe.json")),
  );

  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

  for (const recipeJsonPath of recipeJsonEntries) {
    try {
      const jsonStr = await zip.files[recipeJsonPath].async("string");
      const rawRecipe = JSON.parse(jsonStr) as TandoorRecipe;

      // Directory containing this recipe.json
      const dirPath = recipeJsonPath.includes("/")
        ? recipeJsonPath.slice(0, recipeJsonPath.lastIndexOf("/") + 1)
        : "";

      let imageBuffer: Buffer | undefined;
      let imageExt: string | undefined;

      // 1. Look for explicit image path from rawRecipe.image
      if (
        typeof rawRecipe.image === "string" &&
        rawRecipe.image.trim() &&
        !rawRecipe.image.startsWith("http://") &&
        !rawRecipe.image.startsWith("https://")
      ) {
        const cleanImg = rawRecipe.image.replace(/^\/+/, "").replace(/\\/g, "/");
        const candidates = [
          cleanImg,
          dirPath + cleanImg,
          dirPath ? cleanImg.replace(/^.*\//, dirPath) : cleanImg,
        ];
        const matchKey =
          candidates.find((k) => zip.files[k] && !zip.files[k].dir) ||
          Object.keys(zip.files).find(
            (k) =>
              !zip.files[k].dir &&
              !k.startsWith("__MACOSX/") &&
              (k.endsWith("/" + cleanImg) || k === cleanImg),
          );

        if (matchKey) {
          imageBuffer = await zip.files[matchKey].async("nodebuffer");
          const extMatch = matchKey.match(/\.([a-zA-Z0-9]+)$/);
          imageExt = extMatch ? extMatch[1].toLowerCase() : "jpg";
        }
      }

      // 2. Look for image in same directory as recipe.json
      if (!imageBuffer) {
        const candidateImages = Object.keys(zip.files).filter((name) => {
          if (zip.files[name].dir || name.startsWith("__MACOSX/")) return false;
          if (dirPath && !name.startsWith(dirPath)) return false;
          const lower = name.toLowerCase();
          return imageExtensions.some((ext) => lower.endsWith(ext));
        });

        if (candidateImages.length > 0) {
          const preferred =
            candidateImages.find((img) => /full\.[a-z0-9]+$/i.test(img)) ||
            candidateImages.find((img) => /image\.[a-z0-9]+$/i.test(img)) ||
            candidateImages[0];

          imageBuffer = await zip.files[preferred].async("nodebuffer");
          const extMatch = preferred.match(/\.([a-zA-Z0-9]+)$/);
          imageExt = extMatch ? extMatch[1].toLowerCase() : "jpg";
        }
      }

      // 3. Fallback: if single recipe in archive or inner zip, search anywhere in zip
      if (!imageBuffer && recipeJsonEntries.length === 1) {
        const anyImage = Object.keys(zip.files).find((name) => {
          if (zip.files[name].dir || name.startsWith("__MACOSX/")) return false;
          const lower = name.toLowerCase();
          return imageExtensions.some((ext) => lower.endsWith(ext));
        });

        if (anyImage) {
          imageBuffer = await zip.files[anyImage].async("nodebuffer");
          const extMatch = anyImage.match(/\.([a-zA-Z0-9]+)$/);
          imageExt = extMatch ? extMatch[1].toLowerCase() : "jpg";
        }
      }

      const recipe = tandoorToRecipeInput(rawRecipe, locale);
      results.push({ recipe, imageBuffer, imageExt });
    } catch (err) {
      console.error(`Failed to parse recipe at ${recipeJsonPath}:`, err);
    }
  }

  return results;
}
