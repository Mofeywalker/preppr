import { createGoogle } from "@ai-sdk/google";
import { generateObject, generateImage } from "ai";
import { z } from "zod";
import type { Locale } from "@/i18n/routing";

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const provider = createGoogle({ apiKey });
  return provider("gemini-2.5-flash");
}

function getImageModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const provider = createGoogle({ apiKey });
  return provider.image("gemini-2.5-flash-image");
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
    calories: z.number(),
    proteinG: z.number(),
    carbsG: z.number(),
    fatG: z.number(),
    fiberG: z.number().nullable(),
  }),
});

export type ExtractedRecipe = z.infer<typeof extractSchema>;

const SYSTEM_PROMPT = `You extract structured recipes from cooking video transcripts and descriptions.
Detect the language of the recipe (de for German, en for English) and keep all content in that language.
Extract ingredients with quantities and units. If a quantity can't be determined, leave it null but keep the unit.
Estimate nutrition per serving (calories, protein/carbs/fat/fiber in grams) as best you can.
Return ONLY the structured recipe.`;

export async function extractFromTranscript(
  transcript: string,
  description: string,
  preferredLocale: Locale,
): Promise<ExtractedRecipe> {
  const { object } = await generateObject({
    model: getModel(),
    schema: extractSchema,
    schemaName: "Recipe",
    system: SYSTEM_PROMPT,
    prompt: `Video description:\n${description}\n\nTranscript:\n${transcript}\n\nPrefer the language: ${preferredLocale}.`,
  });
  return object;
}

export async function extractFromAudio(
  audioBase64: string,
  description: string,
  preferredLocale: Locale,
): Promise<ExtractedRecipe> {
  const { object } = await generateObject({
    model: getModel(),
    schema: extractSchema,
    schemaName: "Recipe",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Transcribe this cooking video audio and extract a structured recipe from it. Video description:\n${description}\n\nPrefer the language: ${preferredLocale}.`,
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

export async function generateRecipeImage(
  title: string,
  description: string | null,
): Promise<string> {
  const { image } = await generateImage({
    model: getImageModel(),
    prompt: `A mouth-watering, professional food photograph of: ${title}. ${
      description ?? ""
    } Studio lighting, shallow depth of field, appetizing presentation.`,
  });
  return image.base64;
}
