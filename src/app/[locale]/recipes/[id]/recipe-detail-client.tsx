"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { Spinner } from "@/components/ui/spinner";
import type { FullRecipe } from "@/lib/recipes";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function RecipeDetailClient({ recipe }: { recipe: FullRecipe }) {
  const t = useTranslations("RecipeDetail");
  const tForm = useTranslations("Recipes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [servings, setServings] = useState(recipe.servings);
  const [imgError, setImgError] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(recipe.imageUrl);

  const scale = servings / recipe.servings;

  const onDelete = () => {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      router.push("/");
    });
  };

  const onGenerate = async () => {
    setGenLoading(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true }),
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setImageUrl(url);
      setImgError(false);
    } catch {
      setGenError(t("generateImage"));
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top navigation & desktop action buttons */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <Link
          href="/"
          className="text-sm font-medium text-foreground/60 hover:text-foreground transition flex items-center gap-1"
        >
          ← {t("back")}
        </Link>
        <div className="flex items-center gap-2">
          <a href={`/api/recipes/${recipe.id}/export`} download>
            <Button variant="outline" size="sm" className="gap-1.5">
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("export")}
            </Button>
          </a>
          <Link href={`/recipes/${recipe.id}/edit`}>
            <Button variant="outline" size="sm">
              {t("edit")}
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={pending}
          >
            {pending ? <Spinner /> : t("delete")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Media, Servings scaler, Nutrition, Source (sticky on desktop) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            {imageUrl && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={recipe.title}
                onError={() => setImgError(true)}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 p-6 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGenerate}
                  disabled={genLoading}
                >
                  {genLoading ? <Spinner /> : t("generateImage")}
                </Button>
              </div>
            )}
          </div>
          {genError && <p className="text-xs text-red-600">{genError}</p>}

          {/* Servings Adjuster */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3.5">
            <div>
              <label className="text-sm font-medium block" htmlFor="servings">
                {t("servings")}
              </label>
              <span className="text-xs text-foreground/60">
                {servings !== recipe.servings
                  ? t("scaledFrom", { count: recipe.servings })
                  : t("originalServings", { count: recipe.servings })}
              </span>
            </div>
            <Input
              id="servings"
              type="number"
              min={1}
              inputMode="numeric"
              value={servings}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n > 0) setServings(n);
              }}
              className="h-9 w-24 text-center font-medium bg-background"
            />
          </div>

          {/* Nutrition */}
          <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
              {t("nutrition")}
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <NutRow label={t("calories")} value={recipe.calories} unit="kcal" />
              <NutRow label={t("protein")} value={recipe.proteinG} unit="g" />
              <NutRow label={t("carbs")} value={recipe.carbsG} unit="g" />
              <NutRow label={t("fat")} value={recipe.fatG} unit="g" />
              <NutRow label={t("fiber")} value={recipe.fiberG} unit="g" />
            </div>
          </section>

          {recipe.sourceUrl && (
            <div className="rounded-xl border border-border bg-muted/10 p-3.5 text-xs text-foreground/70">
              <span className="font-semibold text-foreground/80">{t("source")}: </span>
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground break-all"
              >
                {recipe.sourceUrl}
              </a>
            </div>
          )}
        </div>

        {/* Right Column: Title, Metadata, Ingredients, Steps */}
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="mt-2 text-base text-foreground/70 leading-relaxed">
                {recipe.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-lg bg-muted px-3 py-1.5 text-foreground/80">
                {t("prepTime")}: {recipe.prepTimeMin ?? "–"} {tForm("minutes")}
              </span>
              <span className="rounded-lg bg-muted px-3 py-1.5 text-foreground/80">
                {t("cookTime")}: {recipe.cookTimeMin ?? "–"} {tForm("minutes")}
              </span>
              {(recipe.prepTimeMin != null || recipe.cookTimeMin != null) && (
                <span className="rounded-lg bg-muted px-3 py-1.5 text-foreground/80">
                  {t("totalTime")}: {(recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)}{" "}
                  {tForm("minutes")}
                </span>
              )}
            </div>
          </div>

          {/* Ingredients */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight">{t("ingredients")}</h2>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {recipe.ingredients.map((ing) => (
                <div
                  key={ing.id}
                  className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm hover:bg-muted/20 transition"
                >
                  <span className="text-foreground font-medium">{ing.name}</span>
                  <span className="shrink-0 text-foreground/70 font-mono text-xs sm:text-sm">
                    {ing.quantity == null ? "" : fmt(ing.quantity * scale)}{" "}
                    {ing.unit ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Steps */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">{t("steps")}</h2>
            <ol className="space-y-3">
              {recipe.steps.map((s, i) => (
                <li
                  key={s.id}
                  className="flex gap-4 rounded-xl border border-border/60 bg-muted/10 p-3.5 text-sm sm:text-base leading-relaxed"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-foreground/90">{s.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function NutRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  const t = useTranslations("RecipeDetail");
  return (
    <div className="flex items-baseline justify-between rounded-lg bg-muted px-2.5 py-1.5">
      <span className="text-foreground/70">{label}</span>
      <span className="font-medium">
        {value == null ? t("nutritionUnknown") : `${value} ${unit}`}
      </span>
    </div>
  );
}
