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
