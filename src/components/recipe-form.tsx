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
  tags?: string[];
  visibility?: "private" | "shared";
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
    tags: r.tags ?? [],
    visibility: r.visibility,
  };
}

export function RecipeForm({
  initial,
  recipe,
  locale,
  sourceType,
  sourceUrl,
  mode,
  recipeId,
  availableTags,
}: {
  initial?: RecipeFormInitial;
  recipe?: FullRecipe;
  locale: Locale;
  sourceType: "manual" | "youtube" | "tandoor" | "website";
  sourceUrl?: string | null;
  mode: "create" | "edit";
  recipeId?: string;
  availableTags?: string[];
}) {
  const init = recipe ? recipeFormInitialFromFull(recipe) : initial;
  const t = useTranslations("RecipeForm");
  const tErr = useTranslations("Errors");
  const tSharing = useTranslations("Sharing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(init?.title ?? "");
  const [description, setDescription] = useState(init?.description ?? "");
  const [language] = useState<Locale>(init?.language ?? locale);
  const [visibility, setVisibility] = useState<"private" | "shared">(
    init?.visibility ?? "shared",
  );
  const [servings, setServings] = useState(String(init?.servings ?? 4));
  const [prepTime, setPrepTime] = useState(
    init?.prepTimeMin == null ? "" : String(init.prepTimeMin),
  );
  const [cookTime, setCookTime] = useState(
    init?.cookTimeMin == null ? "" : String(init.cookTimeMin),
  );
  const [imageUrl, setImageUrl] = useState(init?.imageUrl ?? "");
  const [ings, setIngs] = useState<IngField[]>(toIngFields(init?.ingredients));
  const [stepList, setStepList] = useState<string[]>(init?.steps ?? [""]);
  const [calories, setCalories] = useState(
    init?.calories == null ? "" : String(init.calories),
  );
  const [protein, setProtein] = useState(
    init?.proteinG == null ? "" : String(init.proteinG),
  );
  const [carbs, setCarbs] = useState(
    init?.carbsG == null ? "" : String(init.carbsG),
  );
  const [fat, setFat] = useState(
    init?.fatG == null ? "" : String(init.fatG),
  );
  const [fiber, setFiber] = useState(
    init?.fiberG == null ? "" : String(init.fiberG),
  );
  const [tags, setTags] = useState<string[]>(init?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [refetchingPhoto, setRefetchingPhoto] = useState(false);
  const [refetchPhotoSuccess, setRefetchPhotoSuccess] = useState(false);
  const [refetchPhotoError, setRefetchPhotoError] = useState<string | null>(null);

  const isYouTube = sourceType === "youtube" && !!sourceUrl;

  const handleRecreatePhoto = async () => {
    if (!recipeId || refetchingPhoto) return;
    setRefetchingPhoto(true);
    setRefetchPhotoError(null);
    setRefetchPhotoSuccess(false);

    try {
      const payload = isYouTube
        ? { refetchYouTube: true }
        : {
            generate: true,
            title: title.trim(),
            description: description.trim(),
          };

      const res = await fetch(`/api/recipes/${recipeId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || (isYouTube ? t("refetchPhotoError") : t("recreatePhotoError")),
        );
      }

      const { url } = await res.json();
      if (url) {
        setImageUrl(url);
        setRefetchPhotoSuccess(true);
        router.refresh();
      }
    } catch (err) {
      setRefetchPhotoError(
        (err as Error).message ||
          (isYouTube ? t("refetchPhotoError") : t("recreatePhotoError")),
      );
    } finally {
      setRefetchingPhoto(false);
    }
  };

  const num = (s: string): number | null =>
    s.trim() === "" ? null : Number(s);

  const addIng = () => setIngs((l) => [...l, { name: "", quantity: "", unit: "" }]);
  const addStep = () => setStepList((l) => [...l, ""]);

  const handleAddTag = (tagToAdd?: string) => {
    const name = (tagToAdd ?? tagInput).trim();
    if (!name) return;
    if (!tags.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setTags((prev) => [...prev, name]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

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
      visibility,
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
      tags,
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
        if (id) {
          router.push(`/recipes/${id}`);
          router.refresh();
        }
      } catch {
        setError(tErr("generic"));
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Basic Details & Nutrition */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-border bg-muted/10 p-5 space-y-4">
            <h2 className="text-base font-semibold tracking-tight">{t("generalInfo")}</h2>

            <div className="space-y-1.5">
              <Label htmlFor="title">{t("title")}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background min-h-24"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="visibility">{tSharing("visibility")}</Label>
                <Select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "private" | "shared")}
                  className="bg-background"
                >
                  <option value="shared">{tSharing("visibilityShared")}</option>
                  <option value="private">{tSharing("visibilityPrivate")}</option>
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
                  className="bg-background"
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
                  className="bg-background"
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
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="imageUrl">{t("imageUrl")}</Label>

              {imageUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={title || "Recipe preview"}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setRefetchPhotoSuccess(false);
                }}
                placeholder="https://…"
                className="bg-background"
              />

              {mode === "edit" && recipeId && (
                <div className="pt-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRecreatePhoto}
                      disabled={refetchingPhoto || pending}
                      className="gap-2 cursor-pointer"
                    >
                      {refetchingPhoto ? (
                        <Spinner />
                      ) : (
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
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                          <path d="M16 21h5v-5" />
                        </svg>
                      )}
                      <span>
                        {refetchingPhoto
                          ? t("refetchingPhoto")
                          : isYouTube
                          ? t("refetchPhoto")
                          : t("recreatePhoto")}
                      </span>
                    </Button>

                    {refetchPhotoSuccess && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ {t("refetchPhotoSuccess")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/60">
                    {isYouTube ? t("refetchPhotoHint") : t("recreatePhotoHint")}
                  </p>
                  {refetchPhotoError && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {refetchPhotoError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/10 p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">{t("tags")}</h2>
              <p className="text-xs text-foreground/60">{t("tagsDescription")}</p>
            </div>

            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={t("tagPlaceholder")}
                className="bg-background"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddTag()}
                disabled={!tagInput.trim()}
                className="shrink-0"
              >
                + {t("addTag")}
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:opacity-70 cursor-pointer rounded-full p-0.5"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {availableTags &&
              availableTags.filter((at) => !tags.some((t) => t.toLowerCase() === at.toLowerCase()))
                .length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <span className="text-xs font-medium text-foreground/50 block mb-1.5">
                    {t("suggestedTags")}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags
                      .filter((at) => !tags.some((t) => t.toLowerCase() === at.toLowerCase()))
                      .slice(0, 10)
                      .map((at) => (
                        <button
                          key={at}
                          type="button"
                          onClick={() => handleAddTag(at)}
                          className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground/70 hover:text-foreground hover:border-foreground/40 transition cursor-pointer"
                        >
                          + {at}
                        </button>
                      ))}
                  </div>
                </div>
              )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/10 p-5 space-y-4">
            <h2 className="text-base font-semibold tracking-tight">{t("nutrition")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumField label={t("calories")} value={calories} onChange={setCalories} />
              <NumField label={t("protein")} value={protein} onChange={setProtein} />
              <NumField label={t("carbs")} value={carbs} onChange={setCarbs} />
              <NumField label={t("fat")} value={fat} onChange={setFat} />
              <NumField label={t("fiber")} value={fiber} onChange={setFiber} />
            </div>
          </div>
        </div>

        {/* Right Column: Ingredients & Steps */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-border bg-muted/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold tracking-tight text-foreground">
                {t("ingredients")}
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addIng}>
                + {t("addIngredient")}
              </Button>
            </div>
            <div className="space-y-2">
              {ings.map((ing, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1 bg-background"
                    placeholder={t("ingredientName")}
                    value={ing.name}
                    onChange={(e) =>
                      setIngs((l) =>
                        l.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    className="w-20 bg-background"
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
                    className="w-20 bg-background"
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
                    className="shrink-0 text-foreground/60 hover:text-red-600"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold tracking-tight text-foreground">
                {t("steps")}
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                + {t("addStep")}
              </Button>
            </div>
            <div className="space-y-2">
              {stepList.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80">
                    {i + 1}
                  </span>
                  <Input
                    className="flex-1 bg-background"
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
                    className="shrink-0 text-foreground/60 hover:text-red-600"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={pending} className="flex-1 h-11 font-medium">
              {pending ? <Spinner /> : t("save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={pending}
              className="h-11"
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
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
