"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Spinner } from "@/components/ui/spinner";
import { RecipeForm, type RecipeFormInitial } from "@/components/recipe-form";
import type { Locale } from "@/i18n/routing";
import type { ExtractedRecipe } from "@/lib/ai";

type ImportResult = {
  recipe: ExtractedRecipe;
  thumbnail: string | null;
  sourceUrl: string;
};

export function ImportClient({ locale }: { locale: Locale }) {
  const t = useTranslations("Import");
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onExtract = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, locale }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "generic" }));
          const key =
            data.error === "invalid-url"
              ? "errorInvalidUrl"
              : data.error === "ai-config"
                ? "errorAiConfig"
                : data.error === "no-transcript"
                  ? "errorNoTranscript"
                  : "error";
          setError(t(key));
          return;
        }
        const data: ImportResult = await res.json();
        setResult(data);
      } catch {
        setError(t("error"));
      }
    });
  };

  if (result) {
    const initial: RecipeFormInitial = {
      title: result.recipe.title,
      description: result.recipe.description,
      language: result.recipe.language,
      servings: result.recipe.servings,
      prepTimeMin: result.recipe.prepTimeMin,
      cookTimeMin: result.recipe.cookTimeMin,
      imageUrl: result.thumbnail,
      calories: result.recipe.nutrition.calories,
      proteinG: result.recipe.nutrition.proteinG,
      carbsG: result.recipe.nutrition.carbsG,
      fatG: result.recipe.nutrition.fatG,
      fiberG: result.recipe.nutrition.fiberG,
      ingredients: result.recipe.ingredients,
      steps: result.recipe.steps,
    };
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <p className="font-medium">{t("review")}</p>
          <p className="text-foreground/60">{t("reviewHint")}</p>
        </div>
        <RecipeForm
          mode="create"
          sourceType="youtube"
          sourceUrl={result.sourceUrl}
          locale={locale}
          initial={initial}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
      <form onSubmit={onExtract} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="yt-url">{t("urlLabel")}</Label>
          <Input
            id="yt-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("urlPlaceholder")}
            inputMode="url"
            autoCapitalize="off"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : t("extract")}
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
