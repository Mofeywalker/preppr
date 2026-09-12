"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PrintableRecipeCard } from "@/components/recipe-card/printable-recipe-card";
import type { FullRecipe } from "@/lib/recipes";

export function RecipePrintClient({
  recipe,
  initialServings,
  autoPrint = false,
}: {
  recipe: FullRecipe;
  initialServings: number;
  autoPrint?: boolean;
}) {
  const t = useTranslations("RecipeCard");

  const [servings, setServings] = useState<number>(
    initialServings > 0 ? initialServings : recipe.servings || 2,
  );
  const [layoutMode, setLayoutMode] = useState<"classic" | "compact">("classic");
  const [showImage, setShowImage] = useState<boolean>(!!recipe.imageUrl);
  const [showNutrition, setShowNutrition] = useState<boolean>(true);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen pb-16 print:pb-0 print:m-0">
      {/* Interactive Controls Toolbar (Hidden when printing) */}
      <div className="print-hide mb-8 rounded-2xl border border-border bg-card/90 backdrop-blur-md p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/recipes/${recipe.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/70 hover:text-foreground transition rounded-lg bg-muted px-3 py-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>{t("back")}</span>
            </Link>

            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {t("title")}
              </h1>
            </div>
          </div>

          {/* Main Action Button */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold gap-2 shadow-sm w-full sm:w-auto cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
              <span>{t("print")}</span>
            </Button>
          </div>
        </div>

        {/* Customization Options Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/60 text-xs">
          {/* Servings scaler */}
          <div className="flex items-center gap-2.5">
            <span className="font-medium text-foreground/80">{t("servings")}:</span>
            <div className="inline-flex items-center border border-border rounded-xl bg-background overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setServings((prev) => Math.max(1, prev - 1))}
                className="px-2.5 py-1.5 hover:bg-muted font-bold transition text-foreground/80 cursor-pointer disabled:opacity-40"
                disabled={servings <= 1}
                title="Weniger Portionen"
              >
                –
              </button>
              <span className="px-3 py-1.5 font-bold text-center min-w-[2.5rem]">
                {servings}
              </span>
              <button
                type="button"
                onClick={() => setServings((prev) => prev + 1)}
                className="px-2.5 py-1.5 hover:bg-muted font-bold transition text-foreground/80 cursor-pointer"
                title="Mehr Portionen"
              >
                +
              </button>
            </div>
          </div>

          {/* Layout Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground/80">{t("layout")}:</span>
            <div className="inline-flex rounded-xl bg-muted p-1 gap-1">
              <button
                type="button"
                onClick={() => setLayoutMode("classic")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutMode === "classic"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {t("layoutClassic")}
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("compact")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutMode === "compact"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {t("layoutCompact")}
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4">
            {recipe.imageUrl && (
              <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground/80 select-none">
                <input
                  type="checkbox"
                  checked={showImage}
                  onChange={(e) => setShowImage(e.target.checked)}
                  className="rounded border-border size-4 accent-[#16a34a]"
                />
                <span>{t("showImage")}</span>
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground/80 select-none">
              <input
                type="checkbox"
                checked={showNutrition}
                onChange={(e) => setShowNutrition(e.target.checked)}
                className="rounded border-border size-4 accent-[#16a34a]"
              />
              <span>{t("showNutrition")}</span>
            </label>
          </div>
        </div>

        {/* PDF Hint alert */}
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
          <span className="text-sm">💡</span>
          <p className="leading-relaxed">{t("pdfTip")}</p>
        </div>
      </div>

      {/* Printable Recipe Card */}
      <div className="flex justify-center print:block">
        <PrintableRecipeCard
          recipe={recipe}
          servings={servings}
          layoutMode={layoutMode}
          showImage={showImage}
          showNutrition={showNutrition}
        />
      </div>
    </div>
  );
}
