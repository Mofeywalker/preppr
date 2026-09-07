import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Resolves the directory where uploaded recipe images are stored.
 * Priority:
 * 1. process.env.UPLOAD_DIR
 * 2. If DATABASE_PATH points to /data (e.g. Unraid Docker), use /data/uploads
 * 3. If DATABASE_PATH is set, use <dirname(DATABASE_PATH)>/uploads
 * 4. Default: <cwd>/public/uploads
 */
export function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  const dbPath = process.env.DATABASE_PATH;
  if (dbPath && (dbPath.startsWith("/data") || dbPath.includes("/data/"))) {
    return "/data/uploads";
  }
  if (dbPath) {
    return join(dirname(dbPath), "uploads");
  }
  return join(process.cwd(), "public", "uploads");
}

export function getMimeType(filenameOrExt: string): string {
  const ext = filenameOrExt.includes(".")
    ? extname(filenameOrExt).toLowerCase()
    : filenameOrExt.toLowerCase();

  switch (ext) {
    case ".jpg":
    case ".jpeg":
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case ".png":
    case "png":
      return "image/png";
    case ".webp":
    case "webp":
      return "image/webp";
    case ".gif":
    case "gif":
      return "image/gif";
    case ".svg":
    case "svg":
      return "image/svg+xml";
    case ".avif":
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

/**
 * Searches for an uploaded image across all potential storage locations.
 */
export async function findUploadedImage(
  filenameOrUrl: string,
): Promise<{ path: string; buffer: Buffer } | null> {
  const cleanName = basename(filenameOrUrl.replace(/^\/uploads\//, ""));
  if (!cleanName || cleanName === "." || cleanName.includes("..")) {
    return null;
  }

  const primaryDir = getUploadDir();
  const candidateDirs = [
    primaryDir,
    join(process.cwd(), "public", "uploads"),
    "/data/uploads",
    join(process.cwd(), "public"),
  ];

  const uniqueDirs = Array.from(new Set(candidateDirs));

  for (const dir of uniqueDirs) {
    const fullPath = join(/*turbopackIgnore: true*/ dir, cleanName);
    try {
      await stat(fullPath);
      const buffer = await readFile(fullPath);
      return { path: fullPath, buffer };
    } catch {
      // not in this dir, try next
    }
  }

  return null;
}

/**
 * Saves an image buffer to disk and returns its relative URL `/uploads/<filename>`.
 */
export async function saveUploadedImage(
  buffer: Buffer,
  originalFilename: string = "image.jpg",
  customFilename?: string,
): Promise<string> {
  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  let filename: string;
  if (customFilename) {
    filename = basename(customFilename);
  } else {
    const extMatch = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    filename = `${randomUUID()}.${ext}`;
  }

  const targetPath = join(/*turbopackIgnore: true*/ uploadDir, filename);
  await writeFile(targetPath, buffer);

  // If uploadDir is not public/uploads, also attempt writing a copy to public/uploads
  // for dev convenience if directory exists, ignoring errors
  const publicUploads = join(process.cwd(), "public", "uploads");
  if (uploadDir !== publicUploads) {
    try {
      await mkdir(publicUploads, { recursive: true });
      await writeFile(join(publicUploads, filename), buffer);
    } catch {
      // ignore in environments like Docker where public may be read-only or not needed
    }
  }

  return `/uploads/${filename}`;
}
