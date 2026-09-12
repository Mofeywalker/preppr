import JSZip from "jszip";
import { basename, extname } from "node:path";
import type { FullRecipe, RecipeInput } from "@/lib/recipes";
import { parseTandoorZip, tandoorToRecipeInput, type TandoorRecipe } from "@/lib/tandoor";
import { saveUploadedImage, findUploadedImage } from "@/lib/storage";
import { getInstanceLocale, type Locale } from "@/i18n/routing";

export { saveUploadedImage, saveUploadedImage as saveRecipeImage };

export interface PrepprExportRecipe {
  id?: string;
  sourceType: "manual" | "youtube" | "tandoor" | "website";
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
  tags?: string[];
}

export interface PrepprExportManifest {
  version: number;
  generator: string;
  exportedAt: string;
  recipes: PrepprExportRecipe[];
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
        // Local uploaded image (check in storage directories)
        const cleanFilename = url.replace(/^\/uploads\//, "");
        const found = await findUploadedImage(cleanFilename);
        if (found) {
          const ext = extname(found.path) || ".jpg";
          const zipImageName = `${recipe.id}${ext}`;
          imagesFolder?.file(zipImageName, found.buffer);
          imageFile = `images/${zipImageName}`;
        } else {
          console.warn(`Local image file not found for recipe ${recipe.id}: ${url}`);
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
      tags: recipe.tags,
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
  tags?: string[];
  keywords?: Array<{ name?: string } | string> | string[];
}

function parseIngredientString(str: string): { name: string; quantity: number | null; unit: string | null } {
  const trimmed = str.trim();
  const match = trimmed.match(/^([\d.,/]+)\s*([a-zA-ZäöüÄÖÜß°]+)?\s+(.+)$/);
  if (match) {
    const rawNum = match[1].replace(",", ".");
    let quantity: number | null = null;
    if (rawNum.includes("/")) {
      const [n, d] = rawNum.split("/").map(Number);
      if (d) quantity = n / d;
    } else {
      const parsed = parseFloat(rawNum);
      if (!isNaN(parsed)) quantity = parsed;
    }
    const unit = match[2]?.trim() || null;
    const name = match[3]?.trim() || "";
    if (name) {
      return { name, quantity, unit };
    }
  }
  return { name: trimmed, quantity: null, unit: null };
}

function sanitizeRecipeInput(item: RawRecipeItem, fallbackLocale: Locale = getInstanceLocale()): RecipeInput {
  const title = (item.title || item.name || "Rezept").trim();
  const description = typeof item.description === "string" ? item.description.trim() || null : null;
  const language = item.language === "en" || item.language === "de" ? item.language : fallbackLocale;
  const servings = typeof item.servings === "number" && item.servings > 0 ? Math.round(item.servings) : 4;
  const prepTimeMin =
    typeof item.prepTimeMin === "number"
      ? Math.round(item.prepTimeMin)
      : typeof (item as any).prep_time_min === "number"
      ? Math.round((item as any).prep_time_min)
      : typeof (item as any).working_time === "number"
      ? Math.round((item as any).working_time)
      : null;
  const cookTimeMin =
    typeof item.cookTimeMin === "number"
      ? Math.round(item.cookTimeMin)
      : typeof (item as any).cook_time_min === "number"
      ? Math.round((item as any).cook_time_min)
      : typeof (item as any).waiting_time === "number"
      ? Math.round((item as any).waiting_time)
      : null;

  const rawIngredients = Array.isArray(item.ingredients) ? item.ingredients : [];
  const ingredients = rawIngredients.map((ing) => {
    if (typeof ing === "string") {
      return parseIngredientString(ing);
    }
    const rawQty = ing.quantity !== undefined ? ing.quantity : (ing as any).amount;
    let quantity: number | null = null;
    if (typeof rawQty === "number" && !isNaN(rawQty)) {
      quantity = rawQty;
    } else if (typeof rawQty === "string" && rawQty.trim()) {
      const cleanedQty = rawQty.trim().replace(",", ".");
      if (cleanedQty.includes("/")) {
        const [n, d] = cleanedQty.split("/").map(Number);
        if (d) quantity = n / d;
      } else {
        const parsed = parseFloat(cleanedQty);
        if (!isNaN(parsed)) quantity = parsed;
      }
    }

    const rawUnit = ing.unit !== undefined ? ing.unit : (ing as any).unit_name;
    let unit: string | null = null;
    if (typeof rawUnit === "string") {
      unit = rawUnit.trim() || null;
    } else if (rawUnit && typeof rawUnit === "object" && "name" in rawUnit) {
      unit = (rawUnit as any).name?.trim() || null;
    }

    let name = ing.name || (ing as any).food?.name || (ing as any).food || "Zutat";
    if (typeof name !== "string") name = "Zutat";

    return {
      name: name.trim() || "Zutat",
      quantity,
      unit,
    };
  });

  if (ingredients.length === 0) {
    ingredients.push({ name: "1 Zutat", quantity: null, unit: null });
  }

  const rawSteps = Array.isArray(item.steps) ? item.steps : [];
  const steps = rawSteps
    .map((s) => {
      if (typeof s === "string") return s.trim();
      if (typeof s === "object" && s) {
        return (s.text || s.instruction || (s as any).name || "").trim();
      }
      return "";
    })
    .filter((s: string) => s.length > 0);

  if (steps.length === 0) {
    steps.push(description || title);
  }

  let tags: string[] = [];
  if (Array.isArray(item.tags)) {
    tags = item.tags
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean);
  } else if (Array.isArray(item.keywords)) {
    tags = item.keywords
      .map((k) =>
        typeof k === "string"
          ? k.trim()
          : typeof k === "object" && k?.name
            ? k.name.trim()
            : "",
      )
      .filter(Boolean);
  }

  const nutritionObj = (item as any).nutrition || {};
  const calories =
    typeof item.calories === "number"
      ? Math.round(item.calories)
      : typeof nutritionObj.calories === "number"
      ? Math.round(nutritionObj.calories)
      : null;
  const proteinG =
    typeof item.proteinG === "number"
      ? item.proteinG
      : typeof nutritionObj.proteinG === "number"
      ? nutritionObj.proteinG
      : typeof (item as any).proteins === "number"
      ? (item as any).proteins
      : null;
  const carbsG =
    typeof item.carbsG === "number"
      ? item.carbsG
      : typeof nutritionObj.carbsG === "number"
      ? nutritionObj.carbsG
      : typeof (item as any).carbohydrates === "number"
      ? (item as any).carbohydrates
      : null;
  const fatG =
    typeof item.fatG === "number"
      ? item.fatG
      : typeof nutritionObj.fatG === "number"
      ? nutritionObj.fatG
      : typeof (item as any).fats === "number"
      ? (item as any).fats
      : null;
  const fiberG =
    typeof item.fiberG === "number"
      ? item.fiberG
      : typeof nutritionObj.fiberG === "number"
      ? nutritionObj.fiberG
      : typeof (item as any).fiber === "number"
      ? (item as any).fiber
      : null;

  return {
    sourceType:
      item.sourceType === "youtube" || item.sourceType === "tandoor" || item.sourceType === "website"
        ? item.sourceType
        : "manual",
    sourceUrl: item.sourceUrl || null,
    language,
    title,
    description,
    servings,
    prepTimeMin,
    cookTimeMin,
    imageUrl: item.imageUrl || null,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    ingredients,
    steps,
    tags,
  };
}

/**
 * Parses a Preppr ZIP archive and extracts all recipes including photos.
 */
export async function parsePrepprZip(
  zipBuffer: Buffer | ArrayBuffer,
  locale: Locale = getInstanceLocale(),
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

  const manifestDir = manifestPath.includes("/")
    ? manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1)
    : "";

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

    // 1. Direct or manifest-relative imageFile path
    if (rawItem.imageFile) {
      const cleanImgFile = rawItem.imageFile.replace(/\\/g, "/").replace(/^\/+/, "");
      const candidates = [
        cleanImgFile,
        manifestDir + cleanImgFile,
        rawItem.imageFile,
      ];
      imageEntryName = candidates.find((c) => zip.files[c] && !zip.files[c].dir) || null;

      if (!imageEntryName) {
        // Check if any file in the zip ends with cleanImgFile
        imageEntryName =
          Object.keys(zip.files).find(
            (k) => !zip.files[k].dir && !k.startsWith("__MACOSX/") && k.endsWith(cleanImgFile),
          ) || null;
      }
    }

    // 2. Search by recipe id
    if (!imageEntryName && rawItem.id) {
      imageEntryName =
        Object.keys(zip.files).find((name) => {
          if (zip.files[name].dir || name.startsWith("__MACOSX/")) return false;
          const base = basename(name, extname(name));
          return base === rawItem.id;
        }) || null;
    }

    // 3. Search by filename in imageUrl if local file path
    if (!imageEntryName && rawItem.imageUrl && !rawItem.imageUrl.startsWith("http")) {
      const urlBase = basename(rawItem.imageUrl);
      if (urlBase && urlBase !== "." && !urlBase.includes("..")) {
        imageEntryName =
          Object.keys(zip.files).find((name) => {
            if (zip.files[name].dir || name.startsWith("__MACOSX/")) return false;
            return basename(name) === urlBase;
          }) || null;
      }
    }

    // 4. Fallback: if single recipe in archive, search anywhere in zip
    if (!imageEntryName && rawList.length === 1) {
      const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
      imageEntryName =
        Object.keys(zip.files).find((name) => {
          if (zip.files[name].dir || name.startsWith("__MACOSX/")) return false;
          return imageExts.some((ext) => name.toLowerCase().endsWith(ext));
        }) || null;
    }

    if (imageEntryName && zip.files[imageEntryName]) {
      try {
        const imgBuffer = await zip.files[imageEntryName].async("nodebuffer");
        const uploadedUrl = await saveUploadedImage(imgBuffer, imageEntryName);
        recipe.imageUrl = uploadedUrl;
      } catch (err) {
        console.warn(`Failed to extract recipe image "${imageEntryName}":`, err);
      }
    } else if (recipe.imageUrl && recipe.imageUrl.startsWith("/uploads/")) {
      // Check if local image already exists on this server, otherwise clear stale link
      const existing = await findUploadedImage(recipe.imageUrl);
      if (!existing) {
        recipe.imageUrl = null;
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
  locale: Locale = getInstanceLocale(),
): Promise<RecipeInput[]> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".json")) {
    const jsonStr = buffer.toString("utf-8");
    const parsed = JSON.parse(jsonStr);

    const isTandoor =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      ("food_properties" in parsed ||
        "servings_text" in parsed ||
        (Array.isArray(parsed.steps) &&
          parsed.steps.length > 0 &&
          typeof parsed.steps[0] === "object" &&
          "instruction" in parsed.steps[0]));

    if (!isTandoor) {
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
          const imageUrl = await saveUploadedImage(item.imageBuffer, `image.${item.imageExt}`);
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
