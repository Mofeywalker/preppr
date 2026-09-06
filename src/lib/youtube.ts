import { YoutubeTranscript } from "youtube-transcript";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const exec = promisify(execFile);
const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";

export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? id : null;
    }
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com"
    ) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return parseYouTubeId(url) !== null;
}

export async function getTranscript(videoId: string): Promise<string | null> {
  try {
    const lines = await YoutubeTranscript.fetchTranscript(videoId);
    if (!lines.length) return null;
    return lines.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return null;
  }
}

export type VideoMetadata = {
  title: string;
  description: string;
  thumbnail: string | null;
};

export async function getMetadata(url: string): Promise<VideoMetadata> {
  const { stdout } = await exec(YT_DLP, [
    "--dump-json",
    "--no-playlist",
    "--no-warnings",
    url,
  ]);
  const data = JSON.parse(stdout) as {
    title: string;
    description: string;
    thumbnail: string;
  };
  return {
    title: data.title ?? "",
    description: data.description ?? "",
    thumbnail: data.thumbnail ?? null,
  };
}

export async function downloadAudio(
  url: string,
): Promise<{ path: string; base64: string }> {
  const dir = join(tmpdir(), "preppr");
  await mkdir(dir, { recursive: true });
  const out = join(dir, `${randomUUID()}.mp3`);

  await exec(YT_DLP, [
    "-x",
    "--audio-format",
    "mp3",
    "--no-playlist",
    "--no-warnings",
    "-o",
    out,
    url,
  ]);

  const buf = await readFile(out);
  const base64 = buf.toString("base64");
  await unlink(out).catch(() => {});
  return { path: out, base64 };
}
