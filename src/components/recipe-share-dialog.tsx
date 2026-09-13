"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toBlob } from "html-to-image";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PrintableRecipeCard } from "@/components/recipe-card/printable-recipe-card";
import { cn } from "@/lib/utils";
import type { FullRecipe } from "@/lib/recipes";

export interface RecipeShareDialogProps {
  open: boolean;
  onClose: () => void;
  recipe: FullRecipe;
  initialServings?: number;
}

export function formatRecipeText(recipe: FullRecipe, servings: number): string {
  const scale = recipe.servings > 0 ? servings / recipe.servings : 1;
  const totalTime = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

  const lines: string[] = [];
  lines.push(`🍳 *${recipe.title}*`);
  if (recipe.description) {
    lines.push(recipe.description);
  }

  const meta: string[] = [];
  meta.push(`👥 ${servings} ${servings === 1 ? "Portion" : "Portionen"}`);
  if (totalTime > 0) meta.push(`⏱️ ${totalTime} Min.`);
  if (recipe.calories) meta.push(`⚡ ${recipe.calories} kcal`);
  lines.push(meta.join(" • ") + "\n");

  lines.push(`*Zutaten:*`);
  for (const ing of recipe.ingredients) {
    const qtyNum = ing.quantity != null ? ing.quantity * scale : null;
    const qtyStr =
      qtyNum != null
        ? Number.isInteger(qtyNum)
          ? `${qtyNum}`
          : qtyNum.toFixed(1).replace(/\.?0+$/, "")
        : "";
    const unitStr = ing.unit ? ` ${ing.unit}` : "";
    const amount = qtyStr || unitStr ? ` (${qtyStr}${unitStr})` : "";
    lines.push(`• ${ing.name}${amount}`);
  }
  lines.push("");

  lines.push(`*Zubereitung:*`);
  recipe.steps.forEach((step, idx) => {
    lines.push(`${idx + 1}. ${step.text}`);
  });

  lines.push("");
  lines.push(`Gekocht mit preppr 💚`);
  return lines.join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RecipeShareDialog({
  open,
  onClose,
  recipe,
  initialServings,
}: RecipeShareDialogProps) {
  const t = useTranslations("ShareDialog");
  const [activeTab, setActiveTab] = useState<"card" | "link" | "text">("card");
  const [servings, setServings] = useState<number>(
    initialServings && initialServings > 0 ? initialServings : recipe.servings || 4,
  );
  const [showImage, setShowImage] = useState<boolean>(!!recipe.imageUrl);
  const [showNutrition, setShowNutrition] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [shareUrl, setShareUrl] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/recipes/${recipe.id}`);
    }
  }, [recipe.id]);

  useEffect(() => {
    if (initialServings && initialServings > 0) {
      setServings(initialServings);
    }
  }, [initialServings]);

  const canNativeShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof File !== "undefined";

  const canNativeShareUrl =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const canCopyImage =
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof window !== "undefined" &&
    "ClipboardItem" in window;

  const generateCardBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    return await toBlob(cardRef.current, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      skipFonts: true,
      quality: 0.95,
      style: {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      },
      filter: (node) => {
        if (node instanceof HTMLElement && node.classList.contains("no-export")) {
          return false;
        }
        return true;
      },
    });
  };

  const handleShareCard = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const blob = await generateCardBlob();
      if (!blob) throw new Error("Could not generate recipe card");

      const safeTitle = recipe.title
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const filename = `${safeTitle || "rezept"}-karte.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (canNativeShareFiles && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: recipe.title,
            text: `${recipe.title} - Rezeptkarte`,
          });
          return;
        } catch (err: unknown) {
          if ((err as Error)?.name === "AbortError") {
            return;
          }
        }
      }

      // Fallback: direct download
      triggerDownload(blob, filename);
    } catch (err) {
      console.error("Failed to share card image:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Bild konnte nicht geteilt werden",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCard = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const blob = await generateCardBlob();
      if (!blob) throw new Error("Could not generate recipe card");

      const safeTitle = recipe.title
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const filename = `${safeTitle || "rezept"}-karte.png`;
      triggerDownload(blob, filename);
    } catch (err) {
      console.error("Failed to download card:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Download fehlgeschlagen",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCard = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const blob = await generateCardBlob();
      if (!blob) throw new Error("Could not generate recipe card");

      if (canCopyImage) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      } else {
        throw new Error(t("imageCopyFailed"));
      }
    } catch (err) {
      console.error("Failed to copy image:", err);
      setErrorMessage(
        err instanceof Error ? err.message : t("imageCopyFailed"),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setErrorMessage("Link konnte nicht kopiert werden");
    }
  };

  const handleShareLink = async () => {
    if (canNativeShareUrl) {
      try {
        await navigator.share({
          title: recipe.title,
          url: shareUrl,
        });
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Error sharing link:", err);
        }
      }
    } else {
      await handleCopyLink();
    }
  };

  const handleCopyText = async () => {
    const text = formatRecipeText(recipe, servings);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      setErrorMessage("Text konnte nicht kopiert werden");
    }
  };

  const handleShareText = async () => {
    const text = formatRecipeText(recipe, servings);
    if (canNativeShareUrl) {
      try {
        await navigator.share({
          title: recipe.title,
          text,
        });
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Error sharing text:", err);
        }
      }
    } else {
      await handleCopyText();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-2xl w-[calc(100%-2rem)] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border/70 pb-3.5 mb-4 shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 text-[#16a34a]"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>{t("title")}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("subtitle")}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          aria-label={t("close")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4.5"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/80 border border-border shrink-0 mb-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("card")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer",
            activeTab === "card"
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5 text-[#16a34a]"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span>{t("tabCard")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("link")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer",
            activeTab === "link"
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5 text-blue-500"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{t("tabLink")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("text")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer",
            activeTab === "text"
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5 text-amber-500"
          >
            <path d="M17 6.1H3" />
            <path d="M21 12.1H3" />
            <path d="M15.1 18H3" />
          </svg>
          <span>{t("tabText")}</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-3 rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center gap-2 shrink-0">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab 1: Recipe Card (Image) */}
      {activeTab === "card" && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3.5 overflow-hidden">
          {/* Card settings bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-2.5 rounded-xl border border-border/70 text-xs shrink-0">
            {/* Servings */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground/80">{t("servings")}:</span>
              <div className="inline-flex items-center border border-border rounded-lg bg-background overflow-hidden">
                <button
                  type="button"
                  onClick={() => setServings((prev) => Math.max(1, prev - 1))}
                  disabled={servings <= 1}
                  className="px-2 py-1 hover:bg-muted font-bold transition text-foreground/80 cursor-pointer disabled:opacity-40"
                  aria-label="Weniger Portionen"
                >
                  –
                </button>
                <span className="px-2.5 py-1 font-bold text-center min-w-[2rem]">
                  {servings}
                </span>
                <button
                  type="button"
                  onClick={() => setServings((prev) => prev + 1)}
                  className="px-2 py-1 hover:bg-muted font-bold transition text-foreground/80 cursor-pointer"
                  aria-label="Mehr Portionen"
                >
                  +
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-3">
              {recipe.imageUrl && (
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground/80 select-none">
                  <input
                    type="checkbox"
                    checked={showImage}
                    onChange={(e) => setShowImage(e.target.checked)}
                    className="rounded border-border size-3.5 accent-[#16a34a]"
                  />
                  <span>{t("showImage")}</span>
                </label>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground/80 select-none">
                <input
                  type="checkbox"
                  checked={showNutrition}
                  onChange={(e) => setShowNutrition(e.target.checked)}
                  className="rounded border-border size-3.5 accent-[#16a34a]"
                />
                <span>{t("showNutrition")}</span>
              </label>
            </div>
          </div>

          {/* Recipe Card Preview */}
          <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto rounded-xl border border-border bg-neutral-100 dark:bg-neutral-900/50 p-2 sm:p-3 shadow-inner">
            <div
              className="bg-white text-neutral-900 rounded-xl overflow-hidden shadow-sm"
              style={{
                backgroundColor: "#ffffff",
                color: "#171717",
                fontFamily:
                  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              <PrintableRecipeCard
                recipe={recipe}
                servings={servings}
                layoutMode="compact"
                showImage={showImage}
                showNutrition={showNutrition}
                exportMode={true}
              />
            </div>
          </div>

          {/* Offscreen high-res capture element (fixed 750px width, guaranteed 2-column layout & system font on any device) */}
          <div
            style={{
              position: "fixed",
              left: "-9999px",
              top: "0",
              width: "750px",
              zIndex: -100,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            <div
              ref={cardRef}
              style={{
                width: "750px",
                backgroundColor: "#ffffff",
                color: "#171717",
                fontFamily:
                  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              <PrintableRecipeCard
                recipe={recipe}
                servings={servings}
                layoutMode="compact"
                showImage={showImage}
                showNutrition={showNutrition}
                exportMode={true}
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed shrink-0">
            💡 {t("cardSubtitle")}
          </p>

          {/* Action buttons */}
          <div className="pt-2 border-t border-border/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <a
                href={`/recipes/${recipe.id}/print?servings=${servings}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                  >
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect width="12" height="8" x="6" y="14" />
                  </svg>
                  <span>{t("printOrPdf")}</span>
                </Button>
              </a>

              {canCopyImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCard}
                  disabled={isGenerating}
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  {copiedImage ? (
                    <>
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span className="text-emerald-600">{t("imageCopied")}</span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-3.5"
                      >
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      <span>{t("copyImage")}</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCard}
                disabled={isGenerating}
                className="text-xs gap-1.5 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{t("downloadImage")}</span>
              </Button>

              <Button
                size="sm"
                onClick={handleShareCard}
                disabled={isGenerating}
                className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold gap-2 cursor-pointer shadow-xs"
              >
                {isGenerating ? (
                  <>
                    <Spinner className="size-3.5" />
                    <span>{t("generatingImage")}</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5"
                    >
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span>{t("shareCard")}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Link */}
      {activeTab === "link" && (
        <div className="flex-1 flex flex-col space-y-4 py-1">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              {t("linkSubtitle")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-mono text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#16a34a]/30"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-1.5 shrink-0 text-xs cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span className="text-emerald-600">{t("linkCopied")}</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    <span>{t("copyLink")}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Info Notice: Access requirement */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span>⚠️</span>
              <span>Zugriffsbeschränkung beachten</span>
            </div>
            <p className="leading-relaxed text-[11px] opacity-90">
              {t("noAccessNotice")}
            </p>
          </div>

          {/* Notice if recipe is private */}
          {recipe.visibility === "private" && (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span>🔒</span>
                <span>Rezept ist privat</span>
              </div>
              <p className="leading-relaxed text-[11px] opacity-90">
                {t("privateNotice")}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-border/70 flex justify-end gap-2">
            <Button
              type="button"
              onClick={handleShareLink}
              size="sm"
              className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold gap-2 cursor-pointer shadow-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>{t("shareLink")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Text */}
      {activeTab === "text" && (
        <div className="flex-1 flex flex-col space-y-3.5 py-1 min-h-0">
          <p className="text-xs text-muted-foreground">{t("textSubtitle")}</p>

          <div className="flex-1 min-h-[160px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 font-mono text-[11px] whitespace-pre-wrap select-all">
            {formatRecipeText(recipe, servings)}
          </div>

          <div className="pt-3 border-t border-border/70 flex items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="text-xs gap-1.5 cursor-pointer"
            >
              {copiedText ? (
                <>
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="text-emerald-600">{t("textCopied")}</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span>{t("copyText")}</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleShareText}
              size="sm"
              className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold gap-2 cursor-pointer shadow-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>{t("shareText")}</span>
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
