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
import { saveUploadedImage } from "@/lib/storage";
import type { Locale } from "@/i18n/routing";
import { getInstanceLocale } from "@/i18n/routing";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  url: z.string().url(),
  locale: z.enum(["de", "en"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "ai-config" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid-url" }, { status: 400 });
  }
  const { url } = parsed.data;
  const locale: Locale = parsed.data.locale || getInstanceLocale();

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

  let thumbnail =
    meta.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : null);

  if (thumbnail) {
    try {
      const res = await fetch(thumbnail, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        thumbnail = await saveUploadedImage(buf, `${videoId}.jpg`);
      }
    } catch {
      // Keep external URL fallback
    }
  }

  return Response.json({
    recipe,
    thumbnail,
    sourceUrl: url,
  });
}
