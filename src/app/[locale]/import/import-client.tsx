"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Spinner } from "@/components/ui/spinner";
import { RecipeForm, type RecipeFormInitial } from "@/components/recipe-form";
import type { Locale } from "@/i18n/routing";
import type { RecipeInput } from "@/lib/recipes";
import type { ExtractedRecipe } from "@/lib/ai";
import { cn } from "@/lib/utils";

type SingleImport = {
  recipe: RecipeInput;
  sourceType: "youtube" | "tandoor";
  sourceUrl?: string | null;
};

export function ImportClient({ locale }: { locale: Locale }) {
  const t = useTranslations("Import");
  const [pending, startTransition] = useTransition();

  // Tab & mode state
  const [activeTab, setActiveTab] = useState<"youtube" | "tandoor">("youtube");
  const [tandoorMode, setTandoorMode] = useState<"file" | "server">("file");

  // YouTube state
  const [ytUrl, setYtUrl] = useState("");

  // Tandoor Server state
  const [serverUrl, setServerUrl] = useState("");
  const [apiToken, setApiToken] = useState("");

  // Tandoor File drag state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common error / result state
  const [error, setError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<SingleImport | null>(null);

  // Batch import state
  const [batchRecipes, setBatchRecipes] = useState<RecipeInput[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [batchSuccessCount, setBatchSuccessCount] = useState<number | null>(null);

  // Reset form when changing tabs
  const switchTab = (tab: "youtube" | "tandoor") => {
    setActiveTab(tab);
    setError(null);
    setSingleResult(null);
    setBatchRecipes(null);
    setBatchSuccessCount(null);
  };

  // YouTube submit handler
  const onExtractYouTube = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSingleResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: ytUrl, locale }),
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
        const data: { recipe: ExtractedRecipe; thumbnail: string | null; sourceUrl: string } = await res.json();
        const recipeInput: RecipeInput = {
          sourceType: "youtube",
          sourceUrl: data.sourceUrl,
          language: data.recipe.language,
          title: data.recipe.title,
          description: data.recipe.description,
          servings: data.recipe.servings,
          prepTimeMin: data.recipe.prepTimeMin,
          cookTimeMin: data.recipe.cookTimeMin,
          imageUrl: data.thumbnail,
          calories: data.recipe.nutrition.calories,
          proteinG: data.recipe.nutrition.proteinG,
          carbsG: data.recipe.nutrition.carbsG,
          fatG: data.recipe.nutrition.fatG,
          fiberG: data.recipe.nutrition.fiberG,
          ingredients: data.recipe.ingredients,
          steps: data.recipe.steps,
        };
        setSingleResult({
          recipe: recipeInput,
          sourceType: "youtube",
          sourceUrl: data.sourceUrl,
        });
      } catch {
        setError(t("error"));
      }
    });
  };

  // Tandoor File upload handler
  const handleFileUpload = (file: File) => {
    setError(null);
    setSingleResult(null);
    setBatchRecipes(null);
    setBatchSuccessCount(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("locale", locale);

    startTransition(async () => {
      try {
        const res = await fetch("/api/import/tandoor/file", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "generic" }));
          setError(data.error === "no-recipes-found" ? t("errorNoRecipes") : t("errorTandoorFile"));
          return;
        }

        const data = await res.json();
        if (data.type === "single") {
          setSingleResult({
            recipe: data.recipe,
            sourceType: "tandoor",
            sourceUrl: data.recipe.sourceUrl,
          });
        } else if (data.type === "batch") {
          const list: RecipeInput[] = data.recipes;
          setBatchRecipes(list);
          setSelectedIndices(new Set(list.map((_, i) => i)));
        }
      } catch {
        setError(t("errorTandoorFile"));
      }
    });
  };

  // Tandoor Server / URL fetch handler
  const onFetchTandoorServer = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSingleResult(null);
    setBatchRecipes(null);
    setBatchSuccessCount(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/import/tandoor/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: serverUrl,
            apiToken: apiToken.trim() || undefined,
            locale,
          }),
        });

        if (!res.ok) {
          setError(t("errorTandoorServer"));
          return;
        }

        const data = await res.json();
        if (data.type === "single") {
          setSingleResult({
            recipe: data.recipe,
            sourceType: "tandoor",
            sourceUrl: data.recipe.sourceUrl || serverUrl,
          });
        } else if (data.type === "list") {
          // If instance recipe list returned, fetch full recipes for the list
          const recipeIds = data.recipes.map((r: { id: number | string }) => r.id);
          if (recipeIds.length === 0) {
            setError(t("errorNoRecipes"));
            return;
          }

          // Fetch full batch details
          const batchRes = await fetch("/api/import/tandoor/fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: serverUrl,
              apiToken: apiToken.trim() || undefined,
              locale,
              recipeIds,
            }),
          });

          if (!batchRes.ok) {
            setError(t("errorTandoorServer"));
            return;
          }

          const batchData = await batchRes.json();
          const list: RecipeInput[] = batchData.recipes;
          setBatchRecipes(list);
          setSelectedIndices(new Set(list.map((_, i) => i)));
        }
      } catch {
        setError(t("errorTandoorServer"));
      }
    });
  };

  // Batch import submission
  const onImportBatch = () => {
    if (!batchRecipes || selectedIndices.size === 0) return;
    setError(null);

    const recipesToImport = batchRecipes.filter((_, i) => selectedIndices.has(i));
    startTransition(async () => {
      try {
        const res = await fetch("/api/recipes/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipes: recipesToImport }),
        });

        if (!res.ok) {
          setError(t("error"));
          return;
        }

        const data = await res.json();
        setBatchSuccessCount(data.count);
        setBatchRecipes(null);
      } catch {
        setError(t("error"));
      }
    });
  };

  // If a single recipe was loaded, display the review & edit form
  if (singleResult) {
    const initial: RecipeFormInitial = {
      title: singleResult.recipe.title,
      description: singleResult.recipe.description,
      language: singleResult.recipe.language,
      servings: singleResult.recipe.servings,
      prepTimeMin: singleResult.recipe.prepTimeMin,
      cookTimeMin: singleResult.recipe.cookTimeMin,
      imageUrl: singleResult.recipe.imageUrl,
      calories: singleResult.recipe.calories,
      proteinG: singleResult.recipe.proteinG,
      carbsG: singleResult.recipe.carbsG,
      fatG: singleResult.recipe.fatG,
      fiberG: singleResult.recipe.fiberG,
      ingredients: singleResult.recipe.ingredients,
      steps: singleResult.recipe.steps,
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSingleResult(null)}
          >
            ← {t("tab" + (singleResult.sourceType === "youtube" ? "Youtube" : "Tandoor"))}
          </Button>
        </div>
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          <p className="font-semibold text-foreground">{t("review")}</p>
          <p className="text-foreground/70 text-xs sm:text-sm mt-0.5">{t("reviewHint")}</p>
        </div>
        <RecipeForm
          mode="create"
          sourceType={singleResult.sourceType}
          sourceUrl={singleResult.sourceUrl}
          locale={locale}
          initial={initial}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/60">{t("description")}</p>
      </div>

      {/* Top Source Switcher Tabs */}
      <div className="flex rounded-xl border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => switchTab("youtube")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition cursor-pointer text-center",
            activeTab === "youtube"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-foreground/60 hover:text-foreground",
          )}
        >
          {t("tabYoutube")}
        </button>
        <button
          type="button"
          onClick={() => switchTab("tandoor")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition cursor-pointer text-center",
            activeTab === "tandoor"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-foreground/60 hover:text-foreground",
          )}
        >
          {t("tabTandoor")}
        </button>
      </div>

      {/* Batch Success Banner */}
      {batchSuccessCount !== null && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="size-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t("batchSuccess", { count: batchSuccessCount })}
            </h3>
          </div>
          <div className="flex justify-center gap-3">
            <Link href="/">
              <Button>{t("viewRecipes")}</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setBatchSuccessCount(null);
                setBatchRecipes(null);
              }}
            >
              {t("title")}
            </Button>
          </div>
        </div>
      )}

      {/* Batch Review / Selection UI */}
      {batchRecipes && (
        <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {t("batchTitle", { count: batchRecipes.length })}
              </h2>
              <p className="text-xs text-foreground/60">{t("batchHint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIndices(new Set(batchRecipes.map((_, i) => i)))}
                className="text-xs text-foreground/70 hover:text-foreground font-medium underline cursor-pointer"
              >
                {t("selectAll")}
              </button>
              <span className="text-foreground/30">•</span>
              <button
                type="button"
                onClick={() => setSelectedIndices(new Set())}
                className="text-xs text-foreground/70 hover:text-foreground font-medium underline cursor-pointer"
              >
                {t("deselectAll")}
              </button>
            </div>
          </div>

          <div className="max-h-96 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background">
            {batchRecipes.map((recipe, idx) => {
              const isChecked = selectedIndices.has(idx);
              return (
                <label
                  key={idx}
                  className="flex items-center gap-3.5 p-3.5 hover:bg-muted/30 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = new Set(selectedIndices);
                      if (e.target.checked) next.add(idx);
                      else next.delete(idx);
                      setSelectedIndices(next);
                    }}
                    className="size-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                  />
                  {recipe.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="size-10 rounded-lg object-cover bg-muted shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-foreground">{recipe.title}</p>
                    <p className="text-xs text-foreground/50">
                      {recipe.servings} {t("review")} • {recipe.ingredients.length} items
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              className="flex-1 h-11 font-medium"
              disabled={pending || selectedIndices.size === 0}
              onClick={onImportBatch}
            >
              {pending ? <Spinner /> : t("importSelected", { count: selectedIndices.size })}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBatchRecipes(null)}
              disabled={pending}
              className="h-11"
            >
              {t("title")}
            </Button>
          </div>
        </div>
      )}

      {/* YouTube Form */}
      {activeTab === "youtube" && !batchRecipes && batchSuccessCount === null && (
        <form onSubmit={onExtractYouTube} className="space-y-4 rounded-2xl border border-border bg-muted/10 p-6">
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground">{t("youtubeTitle")}</h2>
            <p className="text-xs text-foreground/60">{t("youtubeDescription")}</p>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="yt-url">{t("urlLabel")}</Label>
            <Input
              id="yt-url"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
              inputMode="url"
              autoCapitalize="off"
              className="h-11 bg-background"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full h-11 font-medium" disabled={pending || !ytUrl.trim()}>
            {pending ? <Spinner /> : t("extract")}
          </Button>
        </form>
      )}

      {/* Tandoor Form */}
      {activeTab === "tandoor" && !batchRecipes && batchSuccessCount === null && (
        <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-6">
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground">{t("tandoorTitle")}</h2>
            <p className="text-xs text-foreground/60">{t("tandoorDescription")}</p>
          </div>

          {/* Sub-mode selector: File Upload vs Server URL */}
          <div className="flex rounded-lg border border-border bg-muted/20 p-1">
            <button
              type="button"
              onClick={() => setTandoorMode("file")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition cursor-pointer text-center",
                tandoorMode === "file"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-foreground/60 hover:text-foreground",
              )}
            >
              📁 {t("tandoorModeFile")}
            </button>
            <button
              type="button"
              onClick={() => setTandoorMode("server")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition cursor-pointer text-center",
                tandoorMode === "server"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-foreground/60 hover:text-foreground",
              )}
            >
              🌐 {t("tandoorModeServer")}
            </button>
          </div>

          {/* Mode 1: File Upload */}
          {tandoorMode === "file" && (
            <div className="space-y-4 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.json,application/zip,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition",
                  isDragging
                    ? "border-foreground bg-muted/30 scale-[1.01]"
                    : "border-border hover:border-foreground/40 bg-background/50",
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground/60">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {pending ? t("uploading") : t("fileDropzone")}
                  </p>
                  <p className="text-xs text-foreground/50 mt-1">{t("fileHint")}</p>
                </div>
                {pending && <Spinner />}
              </div>
            </div>
          )}

          {/* Mode 2: Server URL / API */}
          {tandoorMode === "server" && (
            <form onSubmit={onFetchTandoorServer} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="server-url">{t("serverUrlLabel")}</Label>
                <Input
                  id="server-url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={t("serverUrlPlaceholder")}
                  inputMode="url"
                  autoCapitalize="off"
                  className="h-11 bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-token">{t("apiTokenLabel")}</Label>
                <Input
                  id="api-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={t("apiTokenPlaceholder")}
                  autoComplete="off"
                  className="h-11 bg-background"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-medium"
                disabled={pending || !serverUrl.trim()}
              >
                {pending ? <Spinner /> : t("fetchRecipes")}
              </Button>
            </form>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
