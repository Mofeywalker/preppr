import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "public", "icons");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Brand SVG with fixed dark background and crisp white foreground + emerald dot
const createSvg = (size, logoScale = 0.65) => {
  const logoSize = Math.round(size * logoScale);
  const offset = Math.round((size - logoSize) / 2);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#09090b" rx="${Math.round(size * 0.15)}" />
    <g transform="translate(${offset}, ${offset}) scale(${logoSize / 64})">
      <!-- P Stem -->
      <rect x="10" y="10" width="9" height="44" rx="4.5" fill="#fafafa"/>
      <!-- Top Prep Compartment -->
      <path d="M22 10H42C48.0751 10 53 14.9249 53 19.5C53 20.3284 52.3284 21 51.5 21H22V10Z" fill="#fafafa"/>
      <!-- Bottom Prep Compartment -->
      <path d="M22 23.5H51.5C52.3284 23.5 53 24.1716 53 25C53 29.5751 48.0751 34.5 42 34.5H22V23.5Z" fill="#fafafa"/>
      <!-- Emerald Accent -->
      <circle cx="42.5" cy="22.25" r="3" fill="#10B981"/>
    </g>
  </svg>`;
};

// Maskable SVG (full bleed `#09090b` with logo in ~58% safe zone for squircle/circle masks)
const createMaskableSvg = (size) => {
  const logoScale = 0.58;
  const logoSize = Math.round(size * logoScale);
  const offset = Math.round((size - logoSize) / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#09090b" />
    <g transform="translate(${offset}, ${offset}) scale(${logoSize / 64})">
      <rect x="10" y="10" width="9" height="44" rx="4.5" fill="#fafafa"/>
      <path d="M22 10H42C48.0751 10 53 14.9249 53 19.5C53 20.3284 52.3284 21 51.5 21H22V10Z" fill="#fafafa"/>
      <path d="M22 23.5H51.5C52.3284 23.5 53 24.1716 53 25C53 29.5751 48.0751 34.5 42 34.5H22V23.5Z" fill="#fafafa"/>
      <circle cx="42.5" cy="22.25" r="3" fill="#10B981"/>
    </g>
  </svg>`;
};

async function generate() {
  const tasks = [
    { name: "icon-192.png", svg: createSvg(192, 0.65) },
    { name: "icon-512.png", svg: createSvg(512, 0.65) },
    { name: "icon-maskable-192.png", svg: createMaskableSvg(192) },
    { name: "icon-maskable-512.png", svg: createMaskableSvg(512) },
    { name: "apple-touch-icon.png", svg: createSvg(180, 0.65) },
  ];

  for (const task of tasks) {
    const filePath = path.join(outDir, task.name);
    await sharp(Buffer.from(task.svg))
      .png({ compressionLevel: 9 })
      .toFile(filePath);
    console.log(`Generated: ${filePath}`);
  }
}

generate().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
