import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateImage } from "ai";
import { z } from "zod";
import { getInstanceLocale, type Locale } from "@/i18n/routing";
import type { ScrapedRecipePage } from "./scraper";
import type { RecipeInput } from "@/lib/recipes";

function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  const provider = createOpenRouter({ apiKey });
  const modelId = process.env.OPENROUTER_MODEL || "gpt-5.6-luna";
  return provider(modelId);
}

function getImageModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  const provider = createOpenRouter({ apiKey });
  const modelId = process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-3.1-flash-image";
  return provider.imageModel(modelId);
}

export const extractSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  language: z.enum(["de", "en"]),
  servings: z.number().int().min(1).max(100),
  prepTimeMin: z.number().int().nullable(),
  cookTimeMin: z.number().int().nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().nullable(),
        unit: z.string().nullable(),
      }),
    )
    .min(1),
  steps: z.array(z.string()).min(1),
  nutrition: z.object({
    calories: z.number().describe("Total calories in kcal per single serving"),
    proteinG: z.number().describe("Protein in grams per single serving"),
    carbsG: z.number().describe("Carbohydrates in grams per single serving"),
    fatG: z.number().describe("Fat in grams per single serving"),
    fiberG: z
      .number()
      .nullable()
      .describe(
        "Dietary fiber in grams per single serving. Calculate or realistically estimate 0 or higher based on plants, vegetables, grains, legumes, or nuts. Do not return null.",
      ),
  }),
});

export type ExtractedRecipe = z.infer<typeof extractSchema>;

function getExtractionSystemPrompt(preferredLocale: Locale) {
  const langName = preferredLocale === "de" ? "German (Deutsch)" : "English";
  return `You extract structured recipes from cooking video transcripts and descriptions.
Extract and translate the recipe into ${langName}. All textual fields including title, description, ingredient names, units, and step instructions MUST be written in ${langName}, regardless of the original language of the video or transcript.
Set the "language" field in the output schema to "${preferredLocale}".

CRITICAL METRIC UNIT REQUIREMENT:
You MUST ensure that the output recipe strictly uses METRIC units (e.g. g, kg, ml, l, cm, °C) and NEVER Imperial / US Customary units (cups, oz, lbs, fl oz, Fahrenheit). If the video or description mentions Imperial / US units, convert them into metric cooking equivalents (e.g. 1 cup flour ≈ 120-125 g, 1 stick butter ≈ 115 g, 1 cup liquid ≈ 240-250 ml, convert °F to °C).

MANDATORY NUTRITION ESTIMATION:
If nutritional values are not mentioned, you MUST calculate or realistically estimate the macro nutritional values per serving (calories, proteinG, carbsG, fatG, and fiberG in grams) based on the ingredients, quantities, and servings. Never return 0 or null for calories, protein, carbs, fat, or fiber unless the dish genuinely contains none (e.g. pure water). Always provide a realistic estimate for fiberG (0 or higher in grams) based on vegetables, grains, legumes, nuts, seeds, or fruits.

Extract ingredients with quantities and units. If a quantity can't be determined, leave it null but keep the unit.
Return ONLY the structured recipe.`;
}

function getWebExtractionSystemPrompt(preferredLocale: Locale) {
  const langName = preferredLocale === "de" ? "German (Deutsch)" : "English";
  return `You extract structured recipes from recipe web pages and structured recipe data.
Extract and translate the recipe into ${langName}. All textual fields including title, description, ingredient names, units, and step instructions MUST be written in ${langName}, regardless of the original language of the source.
Set the "language" field in the output schema to "${preferredLocale}".

CRITICAL METRIC UNIT REQUIREMENT:
You MUST ensure that the output recipe strictly uses METRIC units (e.g. g, kg, ml, l, cm, °C) and NEVER Imperial / US Customary units (cups, oz, ounces, lbs, pounds, fl oz, fluid ounces, pints, quarts, Fahrenheit).
1. Prioritize Metric Options: Many recipe websites include both US Customary and Metric measurements (for example: dual ingredient lists, a metric toggle switch in the HTML, or parenthetical notation like "1 cup (120 g) flour" or "1 tbsp / 15 ml").
   ALWAYS prioritize and extract the METRIC measurement.
2. Mandatory Conversion: If the recipe only provides Imperial / US units, you MUST convert each quantity to standard metric cooking equivalents:
   - 1 cup all-purpose flour ≈ 120-125 g
   - 1 cup granulated sugar ≈ 200 g
   - 1 cup brown sugar ≈ 200-220 g
   - 1 cup butter ≈ 225 g (1 stick butter ≈ 115 g)
   - 1 cup liquids (milk, water, broth, oil) ≈ 240-250 ml
   - 1 oz ≈ 28 g (fluid oz ≈ 30 ml)
   - 1 lb ≈ 450-500 g
   - Convert oven temperatures from °F to °C in instructions (e.g. 350°F ≈ 175°C - 180°C).
3. Permitted Units:
   - Standard metric units: "g", "kg", "ml", "l".
   - Common countable units (e.g. "Stück", "Prise", "TL", "EL" / "piece", "pinch", "tsp", "tbsp") are acceptable for small seasonings and counts, but any volume or weight greater than a tablespoon MUST be expressed in grams (g), kilograms (kg), milliliters (ml), or liters (l).
   - NEVER output "cup", "cups", "oz", "ounce", "lb", "pound", "fl oz" as units.

MANDATORY NUTRITION ESTIMATION:
If nutritional values are not explicitly stated on the webpage or in the structured data, you MUST calculate or realistically estimate the macro nutritional values per serving (calories, proteinG, carbsG, fatG, and fiberG in grams) based on the ingredients, quantities, and number of servings. Never return 0 or null for calories, protein, carbs, fat, or fiber unless the dish genuinely contains none (e.g. pure water). Always provide a realistic estimate for fiberG (0 or higher in grams) based on vegetables, grains, legumes, nuts, seeds, or fruits.

Extract ingredients with quantities and units. If a quantity can't be determined, leave it null but keep the unit if applicable.
Return ONLY the structured recipe.`;
}

function getHandwrittenExtractionSystemPrompt(preferredLocale: Locale) {
  const langName = preferredLocale === "de" ? "German (Deutsch)" : "English";
  return `You are an expert culinary AI specialized in transcribing and structuring recipes from photos of handwritten notes, recipe index cards, family notebooks, and cookbook clippings.
Extract and translate the recipe into ${langName}. All textual fields including title, description, ingredient names, units, and step instructions MUST be written in ${langName}, regardless of the original language of the handwritten text.
Set the "language" field in the output schema to "${preferredLocale}".

HANDWRITING TRANSCRIPTION & MULTI-PHOTO GUIDELINES:
1. Multi-photo consolidation: The user may provide multiple photos representing multiple pages, the front and back of recipe cards, or different sections of the same recipe. Combine them logically and chronologically into a single, complete recipe.
2. Deciphering handwriting & culinary context: Carefully decipher cursive, abbreviations, or informal shorthand (e.g. "TL", "EL", "tbsp", "tsp", "pkg", "Pck.", "Prise", "pinch", "etwas"). If words or numbers are slightly faded or smudged, use culinary knowledge to infer the correct ingredients, measurements, or cooking instructions.
3. Reasonable defaults: If servings, prep time, or cook time are not explicitly noted, infer a sensible default (e.g. 4 servings) or set to null if completely indeterminable.

CRITICAL METRIC UNIT REQUIREMENT:
You MUST ensure that the output recipe strictly uses METRIC units (e.g. g, kg, ml, l, cm, °C) and NEVER Imperial / US Customary units (cups, oz, ounces, lbs, pounds, fl oz, fluid ounces, Fahrenheit).
If the handwritten note uses Imperial units or older customary units (cups, sticks of butter, etc.), convert them into metric cooking equivalents (e.g. 1 cup flour ≈ 120-125 g, 1 stick butter ≈ 115 g, 1 cup liquid ≈ 240-250 ml, convert °F to °C).

MANDATORY NUTRITION ESTIMATION:
Handwritten recipes virtually never contain nutritional data. You MUST calculate or realistically estimate the macro nutritional values per serving (calories, proteinG, carbsG, fatG, and fiberG in grams) based on the ingredients, quantities, and servings. Never return 0 or null for calories, protein, carbs, fat, or fiber unless the dish genuinely contains none. Always provide a realistic estimate for fiberG (0 or higher in grams) based on plant ingredients, grains, vegetables, legumes, or fruits.

Extract ingredients with quantities and units. If a quantity can't be determined, leave it null but keep the unit if applicable.
Return ONLY the structured recipe.`;
}

export async function extractFromTranscript(
  transcript: string,
  description: string,
  preferredLocale: Locale = getInstanceLocale(),
): Promise<ExtractedRecipe> {
  const targetLanguage = preferredLocale === "de" ? "German (Deutsch)" : "English";
  const { object } = await generateObject({
    model: getModel(),
    schema: extractSchema,
    schemaName: "Recipe",
    system: getExtractionSystemPrompt(preferredLocale),
    prompt: `Video description:\n${description}\n\nTranscript:\n${transcript}\n\nOutput all recipe content in ${targetLanguage} with language: "${preferredLocale}". Ensure metric units are used.`,
  });
  return object;
}

export async function extractFromWebpage(
  webpageData: ScrapedRecipePage,
  preferredLocale: Locale = getInstanceLocale(),
): Promise<ExtractedRecipe> {
  const targetLanguage = preferredLocale === "de" ? "German (Deutsch)" : "English";

  const prompt = [
    `Webpage URL: ${webpageData.url}`,
    webpageData.title ? `Page Title: ${webpageData.title}` : "",
    webpageData.description ? `Page Description: ${webpageData.description}` : "",
    webpageData.jsonLdRecipe
      ? `\nStructured Schema.org JSON-LD Recipe:\n${JSON.stringify(webpageData.jsonLdRecipe, null, 2)}\n`
      : "",
    webpageData.textContent ? `\nWebpage Content:\n${webpageData.textContent}` : "",
    `\nExtract the structured recipe in ${targetLanguage} with language: "${preferredLocale}".`,
    `CRITICAL: Ensure ALL ingredients and measurements are strictly in METRIC units (g, ml, kg, l). If nutritional values are missing or incomplete, calculate realistic estimates per serving based on the ingredients and servings.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await generateObject({
    model: getModel(),
    schema: extractSchema,
    schemaName: "Recipe",
    system: getWebExtractionSystemPrompt(preferredLocale),
    prompt,
  });

  return object;
}

export async function extractFromAudio(
  audioBase64: string,
  description: string,
  preferredLocale: Locale = getInstanceLocale(),
): Promise<ExtractedRecipe> {
  const targetLanguage = preferredLocale === "de" ? "German (Deutsch)" : "English";
  const { object } = await generateObject({
    model: getModel(),
    schema: extractSchema,
    schemaName: "Recipe",
    system: getExtractionSystemPrompt(preferredLocale),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Transcribe this cooking video audio and extract a structured recipe from it. Video description:\n${description}\n\nOutput all recipe content in ${targetLanguage} with language: "${preferredLocale}".`,
          },
          {
            type: "file",
            mediaType: "audio/mp3",
            data: Buffer.from(audioBase64, "base64"),
          },
        ],
      },
    ],
  });
  return object;
}

export async function extractFromPhotos(
  images: Array<{ buffer: Buffer; mimeType: string }>,
  preferredLocale: Locale = getInstanceLocale(),
): Promise<ExtractedRecipe> {
  const targetLanguage = preferredLocale === "de" ? "German (Deutsch)" : "English";

  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Buffer; mediaType: string }
  > = [
    {
      type: "text",
      text: `Transcribe this handwritten recipe from the provided ${images.length} photo(s) and extract a structured recipe. Output all recipe content in ${targetLanguage} with language: "${preferredLocale}". Ensure metric units are used and nutrition is estimated.`,
    },
    ...images.map((img) => ({
      type: "file" as const,
      mediaType: img.mimeType || "image/jpeg",
      data: img.buffer,
    })),
  ];

  const { object } = await generateObject({
    model: getModel(),
    schema: extractSchema,
    schemaName: "Recipe",
    system: getHandwrittenExtractionSystemPrompt(preferredLocale),
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });
  return object;
}

export async function generateRecipeImage(
  title: string,
  description: string | null,
): Promise<string> {
  const { image } = await generateImage({
    model: getImageModel(),
    prompt: `A mouth-watering, professional food photograph of: ${title}. ${
      description ?? ""
    } Studio lighting, shallow depth of field, appetizing presentation.`,
    aspectRatio: "16:9",
  });
  return image.base64;
}

export async function transformRecipeImage(
  imageBuffer: Buffer,
  title: string,
  description?: string | null,
): Promise<string> {
  const promptText = [
    `This is a reference image of the prepared food/dish for the recipe: "${title}".`,
    description ? `Recipe description: ${description}` : "",
    `Transform and re-create this image into a professional, mouth-watering food photograph in 16:9 landscape format based on this dish.`,
    `CRITICAL REQUIREMENTS:`,
    `1. The sole focus MUST be the prepared food/dish from this recipe. Keep the food identifiable and true to the recipe.`,
    `2. Completely remove any persons, people, faces, hands, bodies, or human silhouettes.`,
    `3. Completely remove all text overlays, channel titles, logos, subtitles, badges, emojis, borders, and clickbait graphics.`,
    `4. If the original image is in portrait orientation or closely cropped, naturally extend and reframe the scene into a standard 16:9 landscape aspect ratio centered on the food.`,
    `5. Professional food photography style, warm natural lighting, shallow depth of field, appetizing presentation on a table or plate.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { image } = await generateImage({
    model: getImageModel(),
    prompt: {
      images: [imageBuffer],
      text: promptText,
    },
    aspectRatio: "16:9",
  });

  return image.base64;
}

export const processYouTubeThumbnail = transformRecipeImage;

export const nutritionEstimateSchema = z.object({
  calories: z.number().describe("Total calories in kcal per single serving"),
  proteinG: z.number().describe("Protein in grams per single serving"),
  carbsG: z.number().describe("Carbohydrates in grams per single serving"),
  fatG: z.number().describe("Fat in grams per single serving"),
  fiberG: z
    .number()
    .describe(
      "Dietary fiber in grams per single serving. Always provide a realistic non-negative estimate (0 or higher) based on vegetables, grains, legumes, nuts, seeds, and fruits; 0 if dish contains virtually no fiber.",
    ),
});

export type EstimatedNutrition = z.infer<typeof nutritionEstimateSchema>;

export async function estimateRecipeNutrition(recipe: {
  title: string;
  servings: number;
  ingredients: Array<{ name: string; quantity?: number | null; unit?: string | null }>;
}): Promise<{
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}> {
  const ingList = recipe.ingredients
    .map((ing) => {
      const amount = [ing.quantity, ing.unit].filter(Boolean).join(" ");
      return amount ? `- ${amount} ${ing.name}` : `- ${ing.name}`;
    })
    .join("\n");

  const prompt = [
    `Recipe: "${recipe.title}"`,
    `Number of servings: ${recipe.servings || 1}`,
    `Ingredients (total for the recipe):`,
    ingList || "- Not specified",
    "",
    `Calculate or realistically estimate the macro nutritional values PER SINGLE SERVING (calories in kcal, protein, carbs, fat, and dietary fiber in grams).`,
    `Always provide a realistic estimate for dietary fiber in grams (use 0 if the ingredients contain virtually no fiber, but do not return null).`,
    `Divide the total ingredient values by the number of servings (${recipe.servings || 1}).`,
  ].join("\n");

  const { object } = await generateObject({
    model: getModel(),
    schema: nutritionEstimateSchema,
    schemaName: "NutritionEstimate",
    prompt,
  });

  return {
    calories: Math.round(object.calories),
    proteinG: Math.round(object.proteinG * 10) / 10,
    carbsG: Math.round(object.carbsG * 10) / 10,
    fatG: Math.round(object.fatG * 10) / 10,
    fiberG: Math.round(object.fiberG * 10) / 10,
  };
}

export async function populateMissingNutrition(
  recipes: RecipeInput[],
): Promise<RecipeInput[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    return recipes;
  }

  const needsNutrition = (r: RecipeInput) => {
    const hasBase =
      (r.calories != null && r.calories > 0) ||
      (r.proteinG != null && r.proteinG > 0) ||
      (r.carbsG != null && r.carbsG > 0) ||
      (r.fatG != null && r.fatG > 0);
    const hasFiber = r.fiberG != null;
    return (!hasBase || !hasFiber) && Boolean(r.ingredients && r.ingredients.length > 0);
  };

  const missing = recipes.filter(needsNutrition);
  if (missing.length === 0) {
    return recipes;
  }

  // Process in concurrent batches of 4 to prevent rate limits or connection timeouts
  const batchSize = 4;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (r) => {
        try {
          const estimated = await estimateRecipeNutrition({
            title: r.title,
            servings: r.servings,
            ingredients: r.ingredients,
          });
          const hasBase =
            (r.calories != null && r.calories > 0) ||
            (r.proteinG != null && r.proteinG > 0) ||
            (r.carbsG != null && r.carbsG > 0) ||
            (r.fatG != null && r.fatG > 0);

          if (!hasBase) {
            r.calories = estimated.calories;
            r.proteinG = estimated.proteinG;
            r.carbsG = estimated.carbsG;
            r.fatG = estimated.fatG;
            r.fiberG = estimated.fiberG;
          } else if (r.fiberG == null) {
            r.fiberG = estimated.fiberG;
          }
        } catch (err) {
          console.warn(`Could not auto-estimate nutrition for "${r.title}":`, err);
        }
      }),
    );
  }

  return recipes;
}

