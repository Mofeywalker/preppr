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
    <div className="space-y-4">
      <Link href="/" className="text-sm text-foreground/60">
        ← {t("back")}
      </Link>

      {imageUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={recipe.title}
          onError={() => setImgError(true)}
          className="aspect-video w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-muted">
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
      {genError && <p className="text-xs text-red-600">{genError}</p>}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
        {recipe.description && (
          <p className="mt-1 text-sm text-foreground/70">{recipe.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-lg bg-muted px-2.5 py-1">
          {t("prepTime")}: {recipe.prepTimeMin ?? "–"} {tForm("minutes")}
        </span>
        <span className="rounded-lg bg-muted px-2.5 py-1">
          {t("cookTime")}: {recipe.cookTimeMin ?? "–"} {tForm("minutes")}
        </span>
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-muted px-2.5 py-1 underline"
          >
            {t("source")}
          </a>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium" htmlFor="servings">
          {t("servings")}
        </label>
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
          className="h-9 w-24"
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
        <ul className="space-y-1.5">
          {recipe.ingredients.map((ing) => (
            <li
              key={ing.id}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5 text-sm"
            >
              <span>{ing.name}</span>
              <span className="shrink-0 text-foreground/70">
                {ing.quantity == null
                  ? ""
                  : fmt(ing.quantity * scale)}{" "}
                {ing.unit ?? ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("steps")}</h2>
        <ol className="space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={s.id} className="flex gap-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-xs text-background">
                {i + 1}
              </span>
              <span className="pt-0.5">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("nutrition")}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <NutRow label={t("calories")} value={recipe.calories} unit="kcal" />
          <NutRow label={t("protein")} value={recipe.proteinG} unit="g" />
          <NutRow label={t("carbs")} value={recipe.carbsG} unit="g" />
          <NutRow label={t("fat")} value={recipe.fatG} unit="g" />
          <NutRow label={t("fiber")} value={recipe.fiberG} unit="g" />
        </div>
      </section>

      <div className="flex gap-2 pt-2">
        <Link href={`/recipes/${recipe.id}/edit`} className="flex-1">
          <Button variant="outline" className="w-full">
            {t("edit")}
          </Button>
        </Link>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={pending}
          className="flex-1"
        >
          {pending ? <Spinner /> : t("delete")}
        </Button>
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
