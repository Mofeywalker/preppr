"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FullRecipe } from "@/lib/recipes";
import { LogoIcon } from "@/components/logo";

interface PrintableRecipeCardProps {
  recipe: FullRecipe;
  servings: number;
  layoutMode: "classic" | "compact";
  showImage: boolean;
  showNutrition: boolean;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function parseStepText(
  rawText: string,
  stepIndex: number,
): { title: string; body: string } {
  let text = rawText.trim();
  // Strip leading numbering like "1.", "1)", "Schritt 1:", "Step 1:"
  const prefixRegex = new RegExp(
    `^(?:Schritt\\s*|Step\\s*)?0*${stepIndex + 1}[.):\\s-]*`,
    "i",
  );
  text = text.replace(prefixRegex, "").trim();

  // Check for colon separator (e.g. "Tofu vorbereiten: Den Tofu...")
  const colonIdx = text.indexOf(":");
  if (
    colonIdx > 0 &&
    colonIdx <= 45 &&
    !text.slice(0, colonIdx).includes("http")
  ) {
    return {
      title: text.slice(0, colonIdx).trim(),
      body: text.slice(colonIdx + 1).trim(),
    };
  }

  // Check for dash separator (e.g. "Tofu anbraten – Den Tofu in die Pfanne geben...")
  const dashIdx =
    text.indexOf(" – ") !== -1
      ? text.indexOf(" – ")
      : text.indexOf(" - ") !== -1
      ? text.indexOf(" - ")
      : -1;
  if (dashIdx > 0 && dashIdx <= 45) {
    return {
      title: text.slice(0, dashIdx).trim(),
      body: text.slice(dashIdx + 3).trim(),
    };
  }

  // Check for newline separator if first line is a concise headline
  const newlineIdx = text.indexOf("\n");
  if (newlineIdx > 0 && newlineIdx <= 45) {
    const firstLine = text.slice(0, newlineIdx).trim();
    const remaining = text.slice(newlineIdx + 1).trim();
    if (firstLine && remaining && !firstLine.endsWith(".")) {
      return {
        title: firstLine,
        body: remaining,
      };
    }
  }

  return {
    title: "",
    body: text,
  };
}

export function PrintableRecipeCard({
  recipe,
  servings,
  layoutMode,
  showImage,
  showNutrition,
}: PrintableRecipeCardProps) {
  const t = useTranslations("RecipeCard");
  const scale = recipe.servings > 0 ? servings / recipe.servings : 1;

  const totalTime =
    (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

  if (layoutMode === "compact") {
    return (
      <div className="din-a4-page w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-neutral-900 print:text-black font-sans print:border-none border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between print:rounded-none">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-[#16a34a] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-8 rounded-lg bg-[#16a34a] text-white">
              <LogoIcon size={20} className="text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-neutral-900 block leading-none">
                preppr
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">
                {t("title")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            {totalTime > 0 && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                ⏱️ {totalTime} {t("min")}
              </span>
            )}
            <span className="rounded-full bg-emerald-50 text-[#16a34a] border border-emerald-200 px-2.5 py-1">
              👥 {servings} {t("servings")}
            </span>
          </div>
        </div>

        {/* Compact Title + Hero Row */}
        <div className="flex gap-4 items-start mb-4">
          {showImage && recipe.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-36 h-24 sm:w-44 sm:h-28 object-cover rounded-xl border border-neutral-200 shrink-0"
            />
          )}
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-snug">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="text-xs text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                {recipe.description}
              </p>
            )}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {recipe.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2-Column Compact Layout: Left = Ingredients & Nutrition, Right = Steps */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Left Column: Ingredients */}
          <div className="md:col-span-5 space-y-4">
            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <div className="bg-[#16a34a] text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                <span>{t("ingredientsTitle")}</span>
                <span className="text-[11px] opacity-90 font-normal">
                  {t("ingredientsFor", { count: servings })}
                </span>
              </div>
              <div className="divide-y divide-neutral-100 p-1 text-xs">
                {recipe.ingredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-3.5 rounded border border-neutral-400 inline-block shrink-0" />
                      <span className="font-medium text-neutral-800">{ing.name}</span>
                    </div>
                    <span className="font-mono text-neutral-600 shrink-0 text-[11px]">
                      {ing.quantity != null ? fmt(ing.quantity * scale) : ""}{" "}
                      {ing.unit ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kitchen basics */}
            <div className="border border-neutral-200 rounded-xl p-2.5 bg-neutral-50/70 text-[11px] space-y-1">
              <span className="font-bold text-neutral-800 block">
                🥄 {t("fromKitchen")}
              </span>
              <p className="text-neutral-600 leading-snug">{t("kitchenBasics")}</p>
            </div>

            {/* Nutrition */}
            {showNutrition && (
              <div className="border border-neutral-200 rounded-xl p-2.5 text-[11px] space-y-1.5 bg-white">
                <span className="font-bold text-neutral-800 block text-xs">
                  🥗 {t("nutritionPerServing")}
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 flex flex-col justify-center">
                    <span className="text-neutral-500 font-medium">Kalorien</span>
                    <span className="font-bold text-neutral-900 whitespace-nowrap text-xs mt-0.5">
                      {recipe.calories ? `${recipe.calories} kcal` : "–"}
                    </span>
                  </div>
                  <div className="bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 flex flex-col justify-center">
                    <span className="text-neutral-500 font-medium">Protein</span>
                    <span className="font-bold text-neutral-900 whitespace-nowrap text-xs mt-0.5">
                      {recipe.proteinG ? `${recipe.proteinG} g` : "–"}
                    </span>
                  </div>
                  <div className="bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 flex flex-col justify-center">
                    <span className="text-neutral-500 font-medium truncate">Kohlenhydrate</span>
                    <span className="font-bold text-neutral-900 whitespace-nowrap text-xs mt-0.5">
                      {recipe.carbsG ? `${recipe.carbsG} g` : "–"}
                    </span>
                  </div>
                  <div className="bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 flex flex-col justify-center">
                    <span className="text-neutral-500 font-medium">Fett</span>
                    <span className="font-bold text-neutral-900 whitespace-nowrap text-xs mt-0.5">
                      {recipe.fatG ? `${recipe.fatG} g` : "–"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Steps */}
          <div className="md:col-span-7 space-y-2.5">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <span>{t("stepByStep")}</span>
              <span className="text-xs font-normal text-neutral-500">
                ({recipe.steps.length} Schritte)
              </span>
            </h2>

            <div className="space-y-2">
              {recipe.steps.map((step, idx) => {
                const { title, body } = parseStepText(step.text, idx);
                return (
                  <div
                    key={step.id}
                    className="flex gap-2.5 p-2 rounded-xl border border-neutral-200 bg-neutral-50/40 break-inside-avoid text-xs"
                  >
                    <span className="size-5 rounded-full bg-[#16a34a] text-white font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 leading-snug">
                      {title && (
                        <strong className="block font-bold text-neutral-900 mb-0.5">
                          {title}
                        </strong>
                      )}
                      <span className="text-neutral-700 whitespace-pre-line">{body}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500">
          <span>{t("cookedWith")}</span>
          <span className="font-bold text-[#16a34a]">{t("bonAppetit")}</span>
        </div>
      </div>
    );
  }

  // Classic 2-page layout (Front & Back)
  return (
    <div className="w-full max-w-[210mm] mx-auto space-y-8 print:space-y-0 text-neutral-900 font-sans">
      {/* ========================================================================= */}
      {/* PAGE 1: Front Side (Cover, Hero, Info, Ingredients, Nutrition)           */}
      {/* ========================================================================= */}
      <div className="din-a4-page w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between bg-white border border-neutral-200 rounded-2xl p-7 sm:p-9 shadow-sm print:border-none print:shadow-none print:rounded-none break-after-page">
        {/* Header Bar */}
        <div>
          <div className="flex items-center justify-between border-b-2 border-[#16a34a] pb-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-xl bg-[#16a34a] text-white shadow-sm">
                <LogoIcon size={22} className="text-white" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-neutral-900 block leading-none">
                  preppr
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#16a34a]">
                  {t("title")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-xs font-semibold">
              {recipe.prepTimeMin != null && (
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
                  ⏱️ {t("prepTime")}: {recipe.prepTimeMin} {t("min")}
                </span>
              )}
              {totalTime > 0 && (
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
                  ⏲️ {t("totalTime")}: {totalTime} {t("min")}
                </span>
              )}
              <span className="rounded-full bg-emerald-50 text-[#16a34a] border border-emerald-300 px-3 py-1 font-bold">
                👥 {servings} {t("servings")}
              </span>
            </div>
          </div>

          {/* Hero Image */}
          {showImage && recipe.imageUrl && (
            <div className="relative mb-5 overflow-hidden rounded-2xl border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-48 sm:h-56 print:h-40 object-cover"
              />
              <div className="absolute top-3 right-3 flex gap-1.5">
                {recipe.tags &&
                  recipe.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-black/60 backdrop-blur-md text-white px-3 py-1 text-xs font-semibold shadow-sm"
                    >
                      #{tag}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Title and Description */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed max-w-3xl">
                {recipe.description}
              </p>
            )}

            {/* If no image was displayed, display tag chips here */}
            {(!showImage || !recipe.imageUrl) &&
              recipe.tags &&
              recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {recipe.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-neutral-100 text-neutral-700 px-2.5 py-0.5 text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
          </div>

          {/* 2-Column Split: Ingredients (Left) and Nutrition / Utensils (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
            {/* Ingredients */}
            <div className="sm:col-span-7 border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-[#16a34a] text-white px-4 py-2.5 flex items-center justify-between font-bold text-sm">
                <span className="flex items-center gap-2">
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
                    <path d="M3 10h18l-2 10H5L3 10Z" />
                    <path d="M8 10V6a4 4 0 0 1 8 0v4" />
                  </svg>
                  <span>{t("ingredientsTitle")}</span>
                </span>
                <span className="text-xs font-normal opacity-90">
                  {t("ingredientsFor", { count: servings })}
                </span>
              </div>

              <div className="divide-y divide-neutral-100 p-2 text-xs sm:text-sm">
                {recipe.ingredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-baseline justify-between gap-3 py-2 px-2 hover:bg-neutral-50/80 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="size-4 rounded border-2 border-neutral-400 inline-block shrink-0" />
                      <span className="font-semibold text-neutral-800">
                        {ing.name}
                      </span>
                    </div>
                    <span className="font-mono text-neutral-600 shrink-0 font-medium">
                      {ing.quantity != null ? fmt(ing.quantity * scale) : ""}{" "}
                      {ing.unit ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Utensils & Nutrition */}
            <div className="sm:col-span-5 space-y-4">
              {/* Utensils */}
              <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50/70 text-xs space-y-2">
                <span className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 text-[#16a34a]"
                  >
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                    <path d="M7 2v20" />
                    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                  </svg>
                  <span>{t("fromKitchen")}</span>
                </span>
                <p className="text-neutral-600 leading-relaxed">
                  {t("kitchenBasics")}
                </p>
              </div>

              {/* Nutrition */}
              {showNutrition && (
                <div className="border border-neutral-200 rounded-2xl p-4 bg-white text-xs space-y-3">
                  <span className="font-bold text-neutral-900 text-sm block">
                    🥗 {t("nutritionPerServing")}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-center">
                      <span className="text-[11px] font-medium text-neutral-500">Kalorien</span>
                      <span className="font-extrabold text-neutral-900 text-sm whitespace-nowrap mt-0.5">
                        {recipe.calories ? `${recipe.calories} kcal` : "–"}
                      </span>
                    </div>
                    <div className="bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-center">
                      <span className="text-[11px] font-medium text-neutral-500">Protein</span>
                      <span className="font-extrabold text-neutral-900 text-sm whitespace-nowrap mt-0.5">
                        {recipe.proteinG ? `${recipe.proteinG} g` : "–"}
                      </span>
                    </div>
                    <div className="bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-center">
                      <span className="text-[11px] font-medium text-neutral-500">Kohlenhydrate</span>
                      <span className="font-extrabold text-neutral-900 text-sm whitespace-nowrap mt-0.5">
                        {recipe.carbsG ? `${recipe.carbsG} g` : "–"}
                      </span>
                    </div>
                    <div className="bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-center">
                      <span className="text-[11px] font-medium text-neutral-500">Fett</span>
                      <span className="font-extrabold text-neutral-900 text-sm whitespace-nowrap mt-0.5">
                        {recipe.fatG ? `${recipe.fatG} g` : "–"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Source note if available */}
              {recipe.sourceUrl && (
                <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-neutral-700 shrink-0">Quelle:</span>
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-neutral-900 truncate"
                  >
                    {(() => {
                      try {
                        const url = new URL(recipe.sourceUrl);
                        return url.hostname.replace(/^www\./, "");
                      } catch {
                        return recipe.sourceUrl;
                      }
                    })()}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page 1 Bottom Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <span>{t("cookedWith")}</span>
          <span className="font-medium text-neutral-400">
            Seite 1 (Zutaten & Übersicht)
          </span>
          <span className="font-bold text-[#16a34a]">
            👉 Zubereitung auf der Rückseite
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: Back Side (Step-by-Step Instructions)                            */}
      {/* ========================================================================= */}
      <div className="din-a4-page w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between bg-white border border-neutral-200 rounded-2xl p-7 sm:p-9 shadow-sm print:border-none print:shadow-none print:rounded-none print:p-0">
        {/* Header Bar */}
        <div>
          <div className="flex items-center justify-between border-b-2 border-[#16a34a] pb-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-xl bg-[#16a34a] text-white shadow-sm">
                <LogoIcon size={22} className="text-white" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-neutral-900 block leading-none">
                  {t("stepByStep")}
                </span>
                <span className="text-xs font-semibold text-neutral-500">
                  {recipe.title}
                </span>
              </div>
            </div>

            <div className="text-xs font-bold text-[#16a34a] bg-emerald-50 border border-emerald-300 rounded-full px-3 py-1">
              {recipe.steps.length} Schritte
            </div>
          </div>

          {/* Steps Grid: 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
            {recipe.steps.map((step, idx) => {
              const { title, body } = parseStepText(step.text, idx);
              return (
                <div
                  key={step.id}
                  className="rounded-2xl border-2 border-neutral-200/90 bg-neutral-50/40 p-4 sm:p-5 flex flex-col justify-start break-inside-avoid shadow-xs hover:border-[#16a34a]/50 transition"
                >
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="size-8 rounded-full bg-[#16a34a] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {idx + 1}
                    </span>
                    {title ? (
                      <h3 className="font-extrabold text-neutral-900 text-sm sm:text-base leading-snug">
                        {title}
                      </h3>
                    ) : (
                      <h3 className="font-extrabold text-neutral-900 text-sm sm:text-base leading-snug">
                        {t("step", { number: idx + 1 })}
                      </h3>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed flex-1 whitespace-pre-line">
                    {body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Page 2 Bottom Footer */}
        <div className="mt-8 pt-4 border-t-2 border-[#16a34a] flex items-center justify-between text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900">preppr</span>
            <span>•</span>
            <span>{t("cookedWith")}</span>
          </div>
          <span className="font-medium text-neutral-400">
            Seite 2 (Zubereitung)
          </span>
          <span className="font-black text-[#16a34a] text-sm">
            ✨ {t("bonAppetit")}
          </span>
        </div>
      </div>
    </div>
  );
}
