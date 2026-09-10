import * as cheerio from "cheerio";

export interface ScrapedRecipePage {
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
  jsonLdRecipe: Record<string, unknown> | null;
  textContent: string;
}

function findRecipesInJsonLd(obj: unknown, results: Record<string, unknown>[]): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findRecipesInJsonLd(item, results);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  const type = record["@type"];
  if (
    type === "Recipe" ||
    (Array.isArray(type) && type.includes("Recipe")) ||
    (typeof type === "string" && type.toLowerCase().endsWith("/recipe"))
  ) {
    results.push(record);
  }

  if (record["@graph"]) {
    findRecipesInJsonLd(record["@graph"], results);
  }
}

function extractImageFromJsonLd(recipe: Record<string, unknown>): string | null {
  if (!recipe || !recipe.image) return null;

  const img = recipe.image;
  if (typeof img === "string" && img.trim()) {
    return img.trim();
  }

  if (Array.isArray(img) && img.length > 0) {
    const first = img[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object" && first !== null) {
      const firstRecord = first as Record<string, unknown>;
      if (typeof firstRecord.url === "string") return firstRecord.url.trim();
    }
  }

  if (typeof img === "object" && img !== null) {
    const imgRecord = img as Record<string, unknown>;
    if (typeof imgRecord.url === "string" && imgRecord.url.trim()) return imgRecord.url.trim();
    if (typeof imgRecord.contentUrl === "string" && imgRecord.contentUrl.trim()) return imgRecord.contentUrl.trim();
  }

  return null;
}

function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string | null {
  try {
    const trimmed = relativeOrAbsolute.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) {
      return null;
    }
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

export async function fetchWebpage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`fetch-failed: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

export async function scrapeRecipeUrl(url: string): Promise<ScrapedRecipePage> {
  const html = await fetchWebpage(url);
  const $ = cheerio.load(html);

  // 1. Extract JSON-LD scripts
  const jsonLdRecipes: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).text();
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw);
      findRecipesInJsonLd(parsed, jsonLdRecipes);
    } catch {
      // Ignore syntax errors in malformed script tags
    }
  });

  const jsonLdRecipe = jsonLdRecipes.length > 0 ? jsonLdRecipes[0] : null;

  // 2. Extract Title
  const title =
    (jsonLdRecipe && typeof jsonLdRecipe.name === "string" ? jsonLdRecipe.name.trim() : "") ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "";

  // 3. Extract Description
  const description =
    (jsonLdRecipe && typeof jsonLdRecipe.description === "string" ? jsonLdRecipe.description.trim() : "") ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[name="twitter:description"]').attr("content")?.trim() ||
    "";

  // 4. Multi-tier Image Extraction
  let rawImageUrl: string | null = null;

  // Tier 1: JSON-LD image
  if (jsonLdRecipe) {
    rawImageUrl = extractImageFromJsonLd(jsonLdRecipe);
  }

  // Tier 2: OpenGraph / Twitter meta tags
  if (!rawImageUrl) {
    rawImageUrl =
      $('meta[property="og:image"]').attr("content")?.trim() ||
      $('meta[property="og:image:url"]').attr("content")?.trim() ||
      $('meta[name="twitter:image"]').attr("content")?.trim() ||
      $('meta[name="twitter:image:src"]').attr("content")?.trim() ||
      null;
  }

  // Tier 3: Microdata itemprop="image"
  if (!rawImageUrl) {
    const itempropImg = $('[itemprop="image"]').first();
    if (itempropImg.length > 0) {
      rawImageUrl =
        itempropImg.attr("src") ||
        itempropImg.attr("content") ||
        itempropImg.attr("data-src") ||
        null;
    }
  }

  // Tier 4: DOM search in recipe container or article
  if (!rawImageUrl) {
    const candidateContainers = [
      $('[class*="recipe"], [id*="recipe"], [itemtype*="Recipe"], [class*="wprm"], [class*="tasty-recipe"]'),
      $("article"),
      $("main"),
    ];

    for (const container of candidateContainers) {
      if (container.length === 0) continue;

      const imgs = container.find("img");
      for (let i = 0; i < imgs.length; i++) {
        const el = $(imgs[i]);
        const src =
          el.attr("src") ||
          el.attr("data-src") ||
          el.attr("data-lazy-src") ||
          el.attr("data-original");

        if (!src) continue;

        const lowerSrc = src.toLowerCase();
        // Skip tiny icons, tracking pixels, badges, logos, rating stars
        if (
          lowerSrc.includes("icon") ||
          lowerSrc.includes("logo") ||
          lowerSrc.includes("avatar") ||
          lowerSrc.includes("star") ||
          lowerSrc.includes("badge") ||
          lowerSrc.includes("tracking") ||
          lowerSrc.endsWith(".svg")
        ) {
          continue;
        }

        rawImageUrl = src;
        break;
      }

      if (rawImageUrl) break;
    }
  }

  const imageUrl = rawImageUrl ? resolveUrl(rawImageUrl, url) : null;

  // 5. Clean DOM to extract readable text content
  $("script, style, noscript, svg, nav, footer, header, form, iframe, aside").remove();
  $('.advertisement, [id*="ad-"], [class*="ad-"], [class*="social-share"]').remove();

  // Try to grab specific recipe container first
  const recipeContainer = $(
    '[class*="recipe"], [id*="recipe"], [itemtype*="Recipe"], [class*="wprm"], [class*="tasty-recipe"]',
  );

  let textContent = "";
  if (recipeContainer.length > 0) {
    textContent = recipeContainer.text();
  }

  // If recipe container text is small or missing, grab article/main/body
  if (!textContent || textContent.trim().length < 200) {
    const mainEl = $("article, main").first();
    textContent = (mainEl.length > 0 ? mainEl : $("body")).text();
  }

  // Normalize whitespace
  textContent = textContent
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  // Cap size at 35,000 characters
  if (textContent.length > 35000) {
    textContent = textContent.slice(0, 35000);
  }

  return {
    url,
    title,
    description,
    imageUrl,
    jsonLdRecipe,
    textContent,
  };
}
