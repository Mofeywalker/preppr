"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/inputs";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/i18n/routing";
import type { FullRecipe } from "@/lib/recipes";

export type RecipeFormInitial = {
  title?: string;
  description?: string | null;
  language?: Locale;
  servings?: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  imageUrl?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  ingredients?: { name: string; quantity?: number | null; unit?: string | null }[];
  steps?: string[];
};

type IngField = { name: string; quantity: string; unit: string };

function toIngFields(
  list: RecipeFormInitial["ingredients"] = [],
): IngField[] {
  return list.map((i) => ({
    name: i.name,
    quantity: i.quantity == null ? "" : String(i.quantity),
    unit: i.unit ?? "",
  }));
}

export function RecipeForm({
  initial,
  locale,
  sourceType,
  sourceUrl,
  mode,
  recipeId,
}: {
  initial?: RecipeFormInitial;
  locale: Locale;
  sourceType: "manual" | "youtube";
  sourceUrl?: string | null;
  mode: "create" | "edit";
  recipeId?: string;
}) {
  const t = useTranslations("RecipeForm");
  const tErr = useTranslations("Errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [language, setLanguage] = useState<Locale>(initial?.language ?? locale);
  const [servings, setServings] = useState(String(initial?.servings ?? 4));
  const [prepTime, setPrepTime] = useState(
    initial?.prepTimeMin == null ? "" : String(initial.prepTimeMin),
  );
  const [cookTime, setCookTime] = useState(
    initial?.cookTimeMin == null ? "" : String(initial.cookTimeMin),
  );
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [ings, setIngs] = useState<IngField[]>(toIngFields(initial?.ingredients));
  const [stepList, setStepList] = useState<string[]>(initial?.steps ?? [""]);
  const [calories, setCalories] = useState(
    initial?.calories == null ? "" : String(initial.calories),
  );
  const [protein, setProtein] = useState(
    initial?.proteinG == null ? "" : String(initial.proteinG),
  );
  const [carbs, setCarbs] = useState(
    initial?.carbsG == null ? "" : String(initial.carbsG),
  );
  const [fat, setFat] = useState(
    initial?.fatG == null ? "" : String(initial.fatG),
  );
  const [fiber, setFiber] = useState(
    initial?.fiberG == null ? "" : String(initial.fiberG),
  );
  const [error, setError] = useState<string | null>(null);

  const num = (s: string): number | null =>
    s.trim() === "" ? null : Number(s);

  const addIng = () => setIngs((l) => [...l, { name: "", quantity: "", unit: "" }]);
  const addStep = () => setStepList((l) => [...l, ""]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(tErr("titleRequired"));
      return;
    }
    setError(null);

    const payload = {
      sourceType,
      sourceUrl: sourceUrl ?? null,
      language,
      title: title.trim(),
      description: description.trim() || null,
      servings: Number(servings) || 4,
      prepTimeMin: num(prepTime),
      cookTimeMin: num(cookTime),
      imageUrl: imageUrl.trim() || null,
      calories: num(calories),
      proteinG: num(protein),
      carbsG: num(carbs),
      fatG: num(fat),
      fiberG: num(fiber),
      ingredients: ings
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity.trim() === "" ? null : Number(i.quantity),
          unit: i.unit.trim() || null,
        })),
      steps: stepList.map((s) => s.trim()).filter(Boolean),
    };

    startTransition(async () => {
      try {
        let id = recipeId;
        if (mode === "create") {
          const res = await fetch("/api/recipes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(tErr("generic"));
          id = (await res.json()).id;
        } else if (recipeId) {
          const res = await fetch(`/api/recipes/${recipeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(tErr("generic"));
        }
        if (id) router.push(`/recipes/${id}`);
      } catch {
        setError(tErr("generic"));
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="title">{t("title")}</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="language">{t("language")}</Label>
          <Select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Locale)}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="servings">{t("servings")}</Label>
          <Input
            id="servings"
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prep">{t("prepTime")}</Label>
          <Input
            id="prep"
            type="number"
            min={0}
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cook">{t("cookTime")}</Label>
          <Input
            id="cook"
            type="number"
            min={0}
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="imageUrl">{t("imageUrl")}</Label>
        <Input
          id="imageUrl"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-2">
        <Label>{t("ingredients")}</Label>
        <div className="space-y-2">
          {ings.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="flex-1"
                placeholder={t("ingredientName")}
                value={ing.name}
                onChange={(e) =>
                  setIngs((l) =>
                    l.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <Input
                className="w-20"
                type="number"
                placeholder={t("quantity")}
                value={ing.quantity}
                onChange={(e) =>
                  setIngs((l) =>
                    l.map((x, idx) =>
                      idx === i ? { ...x, quantity: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                className="w-20"
                placeholder={t("unit")}
                value={ing.unit}
                onChange={(e) =>
                  setIngs((l) =>
                    l.map((x, idx) => (idx === i ? { ...x, unit: e.target.value } : x)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIngs((l) => l.filter((_, idx) => idx !== i))}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addIng}>
          + {t("addIngredient")}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{t("steps")}</Label>
        <div className="space-y-2">
          {stepList.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="flex-1"
                placeholder={`${t("stepText")} ${i + 1}`}
                value={s}
                onChange={(e) =>
                  setStepList((l) =>
                    l.map((x, idx) => (idx === i ? e.target.value : x)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setStepList((l) => l.filter((_, idx) => idx !== i))}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addStep}>
          + {t("addStep")}
        </Button>
      </div>

      <details className="space-y-2">
        <summary className="cursor-pointer text-sm font-medium text-foreground/80">
          {t("nutrition")}
        </summary>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <NumField label={t("calories")} value={calories} onChange={setCalories} />
          <NumField label={t("protein")} value={protein} onChange={setProtein} />
          <NumField label={t("carbs")} value={carbs} onChange={setCarbs} />
          <NumField label={t("fat")} value={fat} onChange={setFat} />
          <NumField label={t("fiber")} value={fiber} onChange={setFiber} />
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? <Spinner /> : t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function recipeFormInitialFromFull(r: FullRecipe): RecipeFormInitial {
  return {
    title: r.title,
    description: r.description,
    language: r.language as Locale,
    servings: r.servings,
    prepTimeMin: r.prepTimeMin,
    cookTimeMin: r.cookTimeMin,
    imageUrl: r.imageUrl,
    calories: r.calories,
    proteinG: r.proteinG,
    carbsG: r.carbsG,
    fatG: r.fatG,
    fiberG: r.fiberG,
    ingredients: r.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    })),
    steps: r.steps.map((s) => s.text),
  };
}
