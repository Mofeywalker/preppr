/**
 * Extracts a valid HTTP/HTTPS URL from a share target payload.
 * Many mobile apps (like YouTube or Twitter on Android) send the URL
 * embedded within the 'text' parameter alongside the video/post title,
 * or sometimes in the 'url' parameter.
 */
export function extractUrlFromShareData(
  url?: string | null,
  text?: string | null
): string {
  const combined = [url, text].filter(Boolean).join(" ");
  if (!combined) return "";

  const match = combined.match(/https?:\/\/[^\s<>"'`]+/i);
  if (!match) return "";

  let cleaned = match[0];
  // Strip trailing punctuation often attached when sharing from messages or apps
  cleaned = cleaned.replace(/[.,;:!?)}\]\\>]+$/, "");
  return cleaned;
}

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
