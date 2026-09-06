import { NextRequest } from "next/server";
import { z } from "zod";
import {
  isYouTubeUrl,
  parseYouTubeId,
  getTranscript,
  getMetadata,
  downloadAudio,
} from "@/lib/youtube";
import { extractFromTranscript, extractFromAudio, type ExtractedRecipe } from "@/lib/ai";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  url: z.string().url(),
  locale: z.enum(["de", "en"]).default("en"),
});

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "ai-config" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid-url" }, { status: 400 });
  }
  const { url, locale } = parsed.data as { url: string; locale: Locale };

  if (!isYouTubeUrl(url)) {
    return Response.json({ error: "invalid-url" }, { status: 400 });
  }
  const videoId = parseYouTubeId(url)!;

  let meta;
  try {
    meta = await getMetadata(url);
  } catch {
    meta = { title: "", description: "", thumbnail: null };
  }

  const transcript = await getTranscript(videoId);

  let recipe: ExtractedRecipe;
  try {
    if (transcript && transcript.length > 0) {
      recipe = await extractFromTranscript(transcript, meta.description, locale);
    } else {
      const { base64 } = await downloadAudio(url);
      recipe = await extractFromAudio(base64, meta.description, locale);
    }
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (transcript === null) {
      return Response.json(
        { error: "no-transcript", detail: message },
        { status: 502 },
      );
    }
    return Response.json(
      { error: "extraction-failed", detail: message },
      { status: 502 },
    );
  }

  return Response.json({
    recipe,
    thumbnail: meta.thumbnail,
    sourceUrl: url,
  });
}
