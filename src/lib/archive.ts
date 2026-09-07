import JSZip from "jszip";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { FullRecipe, RecipeInput } from "@/lib/recipes";
import { parseTandoorZip, tandoorToRecipeInput, type TandoorRecipe } from "@/lib/tandoor";
import type { Locale } from "@/i18n/routing";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

export interface PrepprExportRecipe {
  id?: string;
  sourceType: "manual" | "youtube" | "tandoor";
  sourceUrl?: string | null;
  language: "de" | "en";
  title: string;
  description?: string | null;
  servings: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  imageUrl?: string | null;
  imageFile?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  ingredients: { name: string; quantity?: number | null; unit?: string | null }[];
  steps: string[];
}

export interface PrepprExportManifest {
  version: number;
  generator: string;
  exportedAt: string;
  recipes: PrepprExportRecipe[];
}

export async function saveRecipeImage(
  buffer: Buffer,
  originalFilename: string = "image.jpg",
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const extMatch = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

/**
 * Creates a downloadable ZIP archive containing recipes and their photos.
 */
export async function exportRecipesToZip(recipes: FullRecipe[]): Promise<Buffer> {
  const zip = new JSZip();
  const imagesFolder = zip.folder("images");

  const exportedRecipes: PrepprExportRecipe[] = [];

  for (const recipe of recipes) {
    let imageFile: string | null = null;

    if (recipe.imageUrl) {
      const url = recipe.imageUrl.trim();
      if (url.startsWith("/uploads/") || !url.startsWith("http")) {
        // Local uploaded image
        const relativePath = url.startsWith("/") ? url.slice(1) : url;
        const localPath = join(process.cwd(), "public", relativePath);
        try {
          await stat(localPath);
          const buffer = await readFile(localPath);
          const ext = extname(localPath) || ".jpg";
          const zipImageName = `${recipe.id}${ext}`;
          imagesFolder?.file(zipImageName, buffer);
          imageFile = `images/${zipImageName}`;
        } catch {
          console.warn(`Local image file not found for recipe ${recipe.id}: ${localPath}`);
        }
      } else if (url.startsWith("http://") || url.startsWith("https://")) {
        // External image: fetch and embed into archive
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = res.headers.get("content-type") || "";
            let ext = ".jpg";
            if (contentType.includes("png")) ext = ".png";
            else if (contentType.includes("webp")) ext = ".webp";
            else if (contentType.includes("gif")) ext = ".gif";
            else {
              const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
              if (match) ext = `.${match[1]}`;
            }
            const zipImageName = `${recipe.id}${ext}`;
            imagesFolder?.file(zipImageName, buffer);
            imageFile = `images/${zipImageName}`;
          }
        } catch (err) {
          console.warn(`Could not download remote image for recipe ${recipe.id}:`, err);
        }
      }
    }

    exportedRecipes.push({
      id: recipe.id,
      sourceType: recipe.sourceType,
      sourceUrl: recipe.sourceUrl,
      language: recipe.language,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      imageUrl: recipe.imageUrl,
      imageFile,
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG: recipe.carbsG,
      fatG: recipe.fatG,
      fiberG: recipe.fiberG,
      ingredients: recipe.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      steps: recipe.steps.map((st) => st.text),
    });
  }

  const manifest: PrepprExportManifest = {
    version: 1,
    generator: "preppr",
    exportedAt: new Date().toISOString(),
    recipes: exportedRecipes,
  };

  zip.file("recipes.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export interface RawRecipeItem {
  id?: string;
  sourceType?: string;
  sourceUrl?: string | null;
  language?: string;
  title?: string;
  name?: string;
  description?: string | null;
  servings?: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  imageUrl?: string | null;
  imageFile?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  ingredients?: Array<{ name?: string; quantity?: number | null; unit?: string | null } | string>;
  steps?: Array<{ text?: string; instruction?: string } | string>;
}

function sanitizeRecipeInput(item: RawRecipeItem, fallbackLocale: Locale = "de"): RecipeInput {
  const title = (item.title || item.name || "Rezept").trim();
  const description = typeof item.description === "string" ? item.description.trim() || null : null;
  const language = item.language === "en" || item.language === "de" ? item.language : fallbackLocale;
  const servings = typeof item.servings === "number" && item.servings > 0 ? Math.round(item.servings) : 4;
  const prepTimeMin = typeof item.prepTimeMin === "number" ? Math.round(item.prepTimeMin) : null;
  const cookTimeMin = typeof item.cookTimeMin === "number" ? Math.round(item.cookTimeMin) : null;

  const rawIngredients = Array.isArray(item.ingredients) ? item.ingredients : [];
  const ingredients = rawIngredients.map((ing) => {
    if (typeof ing === "string") {
      return { name: ing, quantity: null, unit: null };
    }
    return {
      name: ing.name || "Zutat",
      quantity: typeof ing.quantity === "number" ? ing.quantity : null,
      unit: typeof ing.unit === "string" ? ing.unit.trim() || null : null,
    };
  });

  if (ingredients.length === 0) {
    ingredients.push({ name: "1 Zutat", quantity: null, unit: null });
  }

  const rawSteps = Array.isArray(item.steps) ? item.steps : [];
  const steps = rawSteps
    .map((s) => (typeof s === "string" ? s : s?.text || s?.instruction || ""))
    .filter((s: string) => s.trim().length > 0);

  if (steps.length === 0) {
    steps.push(description || title);
  }

  return {
    sourceType: item.sourceType === "youtube" || item.sourceType === "tandoor" ? item.sourceType : "manual",
    sourceUrl: item.sourceUrl || null,
    language,
    title,
    description,
    servings,
    prepTimeMin,
    cookTimeMin,
    imageUrl: item.imageUrl || null,
    calories: typeof item.calories === "number" ? Math.round(item.calories) : null,
    proteinG: typeof item.proteinG === "number" ? item.proteinG : null,
    carbsG: typeof item.carbsG === "number" ? item.carbsG : null,
    fatG: typeof item.fatG === "number" ? item.fatG : null,
    fiberG: typeof item.fiberG === "number" ? item.fiberG : null,
    ingredients,
    steps,
  };
}

/**
 * Parses a Preppr ZIP archive and extracts all recipes including photos.
 */
export async function parsePrepprZip(
  zipBuffer: Buffer | ArrayBuffer,
  locale: Locale = "de",
): Promise<RecipeInput[]> {
  const zip = await JSZip.loadAsync(zipBuffer);

  // Find recipes.json or preppr-recipes.json (ignoring macOS metadata)
  const manifestPath = Object.keys(zip.files).find(
    (name) =>
      !zip.files[name].dir &&
      !name.startsWith("__MACOSX/") &&
      !name.includes("/.") &&
      (name.toLowerCase() === "recipes.json" ||
        name.toLowerCase().endsWith("/recipes.json") ||
        name.toLowerCase() === "preppr-recipes.json" ||
        name.toLowerCase().endsWith("/preppr-recipes.json")),
  );

  if (!manifestPath) {
    throw new Error("No recipes.json found in Preppr ZIP archive");
  }

  const jsonStr = await zip.files[manifestPath].async("string");
  const manifestData = JSON.parse(jsonStr);

  const rawList: RawRecipeItem[] = Array.isArray(manifestData)
    ? manifestData
    : Array.isArray(manifestData.recipes)
      ? manifestData.recipes
      : [manifestData];

  const results: RecipeInput[] = [];

  for (const rawItem of rawList) {
    const recipe = sanitizeRecipeInput(rawItem, locale);

    // Look for image file inside the ZIP archive
    let imageEntryName: string | null = null;
    if (rawItem.imageFile && zip.files[rawItem.imageFile] && !zip.files[rawItem.imageFile].dir) {
      imageEntryName = rawItem.imageFile;
    } else if (rawItem.id) {
      // Fallback: search images folder for matching recipe id
      const candidate = Object.keys(zip.files).find(
        (name) =>
          !zip.files[name].dir &&
          !name.startsWith("__MACOSX/") &&
          (name === `images/${rawItem.id}.jpg` ||
            name === `images/${rawItem.id}.png` ||
            name === `images/${rawItem.id}.webp` ||
            name.startsWith(`images/${rawItem.id}.`)),
      );
      if (candidate) imageEntryName = candidate;
    }

    if (imageEntryName && zip.files[imageEntryName]) {
      try {
        const imgBuffer = await zip.files[imageEntryName].async("nodebuffer");
        const uploadedUrl = await saveRecipeImage(imgBuffer, imageEntryName);
        recipe.imageUrl = uploadedUrl;
      } catch (err) {
        console.warn(`Failed to extract recipe image "${imageEntryName}":`, err);
      }
    }

    results.push(recipe);
  }

  return results;
}

/**
 * Universal archive parser supporting both Preppr and Tandoor formats.
 */
export async function parseRecipeUpload(
  buffer: Buffer,
  filename: string,
  locale: Locale = "de",
): Promise<RecipeInput[]> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".json")) {
    const jsonStr = buffer.toString("utf-8");
    const parsed = JSON.parse(jsonStr);

    if (
      parsed.generator === "preppr" ||
      Array.isArray(parsed.recipes) ||
      (Array.isArray(parsed) && parsed[0]?.title && Array.isArray(parsed[0]?.steps))
    ) {
      const list: RawRecipeItem[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.recipes)
          ? parsed.recipes
          : [parsed];
      return list.map((item: RawRecipeItem) => sanitizeRecipeInput(item, locale));
    }

    // Otherwise assume Tandoor JSON
    return [tandoorToRecipeInput(parsed as TandoorRecipe, locale)];
  }

  if (lower.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(buffer);

    const hasPrepprManifest = Object.keys(zip.files).some(
      (name) =>
        !name.startsWith("__MACOSX/") &&
        (name.toLowerCase() === "recipes.json" ||
          name.toLowerCase().endsWith("/recipes.json") ||
          name.toLowerCase() === "preppr-recipes.json" ||
          name.toLowerCase().endsWith("/preppr-recipes.json")),
    );

    if (hasPrepprManifest) {
      return parsePrepprZip(buffer, locale);
    }

    // Otherwise handle as Tandoor ZIP
    const extractedTandoor = await parseTandoorZip(buffer, locale);
    for (const item of extractedTandoor) {
      if (item.imageBuffer && item.imageExt) {
        try {
          const imageUrl = await saveRecipeImage(item.imageBuffer, `image.${item.imageExt}`);
          item.recipe.imageUrl = imageUrl;
        } catch (err) {
          console.warn("Failed to save extracted Tandoor image:", err);
        }
      }
    }

    return extractedTandoor.map((item) => item.recipe);
  }

  throw new Error("Unsupported file type. Please upload a .zip or .json file.");
}
