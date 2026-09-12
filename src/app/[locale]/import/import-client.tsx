"use client";

import { useState, useTransition, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Spinner } from "@/components/ui/spinner";
import { RecipeForm, type RecipeFormInitial } from "@/components/recipe-form";
import type { Locale } from "@/i18n/routing";
import type { RecipeInput } from "@/lib/recipes";
import type { ExtractedRecipe } from "@/lib/ai";
import { extractUrlFromShareData } from "@/lib/urls";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};
function getClipboardSnapshot() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.clipboard && typeof navigator.clipboard.readText === "function")
  );
}
function getClipboardServerSnapshot() {
  return false;
}

type SingleImport = {
  recipe: RecipeInput;
  sourceType: "manual" | "youtube" | "tandoor" | "website";
  sourceUrl?: string | null;
};

export function ImportClient({
  locale,
  availableTags,
  initialUrl,
}: {
  locale: Locale;
  availableTags?: string[];
  initialUrl?: string;
}) {
  const t = useTranslations("Import");
  const [pending, startTransition] = useTransition();

  // Tab & mode state
  const [activeTab, setActiveTab] = useState<"youtube" | "photos" | "preppr" | "tandoor">(
    "youtube",
  );
  const [tandoorMode, setTandoorMode] = useState<"file" | "server">("file");

  // YouTube / Web URL state
  const [ytUrl, setYtUrl] = useState(initialUrl || "");
  const [sharedNotice, setSharedNotice] = useState(Boolean(initialUrl));
  const hasClipboard = useSyncExternalStore(
    emptySubscribe,
    getClipboardSnapshot,
    getClipboardServerSnapshot,
  );

  // Photos scan state
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const photoGalleryInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when initialUrl prop updates
  const [prevInitialUrl, setPrevInitialUrl] = useState(initialUrl);
  if (initialUrl !== prevInitialUrl) {
    setPrevInitialUrl(initialUrl);
    if (initialUrl) {
      setYtUrl(initialUrl);
      setActiveTab("youtube");
      setSharedNotice(true);
    }
  }

  // Preppr mode & JSON paste state
  const [prepprMode, setPrepprMode] = useState<"paste" | "file">("paste");
  const [pastedJson, setPastedJson] = useState("");

  const isPastedJsonValid = (() => {
    const trimmed = pastedJson.trim();
    if (!trimmed) return false;
    let cleaned = trimmed;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    try {
      const parsed = JSON.parse(cleaned);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  })();

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("```json")) {
        let cleaned = trimmed;
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        }
        setPastedJson(cleaned);
        setActiveTab("preppr");
        setPrepprMode("paste");
        setError(null);
        return;
      }
      const extracted = extractUrlFromShareData(null, text);
      if (extracted) {
        setYtUrl(extracted);
        setError(null);
        setSharedNotice(true);
      } else if (trimmed) {
        setYtUrl(trimmed);
        setError(null);
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  // Tandoor Server state
  const [serverUrl, setServerUrl] = useState("");
  const [apiToken, setApiToken] = useState("");

  // File drag state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prepprFileInputRef = useRef<HTMLInputElement>(null);

  // Common error / result state
  const [error, setError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<SingleImport | null>(null);

  // Batch import state
  const [batchRecipes, setBatchRecipes] = useState<RecipeInput[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [batchSuccessCount, setBatchSuccessCount] = useState<number | null>(null);

  // Reset form when changing tabs
  const switchTab = (tab: "youtube" | "photos" | "preppr" | "tandoor") => {
    setActiveTab(tab);
    setError(null);
    setSingleResult(null);
    setBatchRecipes(null);
    setBatchSuccessCount(null);
  };

  const handleFilesAdded = (incomingFiles: FileList | File[]) => {
    setError(null);
    const valid = Array.from(incomingFiles).filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name),
    );
    if (valid.length === 0) {
      setError(t("errorNoPhotos"));
      return;
    }
    const combined = [...selectedPhotos, ...valid].slice(0, 10);
    setSelectedPhotos(combined);
    setPhotoPreviews(combined.map((f) => URL.createObjectURL(f)));
  };

  const removePhoto = (index: number) => {
    const next = selectedPhotos.filter((_, i) => i !== index);
    setSelectedPhotos(next);
    setPhotoPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const onExtractPhotos = () => {
    if (selectedPhotos.length === 0) {
      setError(t("errorNoPhotos"));
      return;
    }
    setError(null);
    setSingleResult(null);

    const formData = new FormData();
    formData.append("locale", locale);
    for (const file of selectedPhotos) {
      formData.append("photos", file);
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/import/photos", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "generic" }));
          const key =
            data.error === "ai-config"
              ? "errorAiConfig"
              : data.error === "no-photos"
                ? "errorNoPhotos"
                : data.error === "extraction-failed"
                  ? "errorPhotoExtraction"
                  : "error";
          setError(t(key));
          return;
        }

        const data: {
          recipe: ExtractedRecipe;
          thumbnail: string | null;
          sourceType?: "manual";
        } = await res.json();

        const recipeInput: RecipeInput = {
          sourceType: "manual",
          sourceUrl: null,
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
          sourceType: "manual",
          sourceUrl: null,
        });
      } catch {
        setError(t("error"));
      }
    });
  };

  // URL submit handler (YouTube & Web)
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
              : data.error === "fetch-failed"
                ? "errorFetchFailed"
                : data.error === "extraction-failed"
                  ? "errorExtractionFailed"
                  : data.error === "ai-config"
                    ? "errorAiConfig"
                    : data.error === "no-transcript"
                      ? "errorNoTranscript"
                      : "error";
          setError(t(key));
          return;
        }
        const data: {
          recipe: ExtractedRecipe;
          thumbnail: string | null;
          sourceUrl: string;
          sourceType?: "youtube" | "website";
        } = await res.json();
        const effectiveSourceType = data.sourceType || "website";
        const recipeInput: RecipeInput = {
          sourceType: effectiveSourceType,
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
          sourceType: effectiveSourceType,
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
        const res = await fetch("/api/import/file", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "generic" }));
          setError(
            data.error === "no-recipes-found"
              ? t("errorNoRecipes")
              : activeTab === "preppr"
                ? t("errorPrepprFile")
                : t("errorTandoorFile"),
          );
          return;
        }

        const data = await res.json();
        if (data.type === "single") {
          setSingleResult({
            recipe: data.recipe,
            sourceType: data.recipe.sourceType || "manual",
            sourceUrl: data.recipe.sourceUrl,
          });
        } else if (data.type === "batch") {
          const list: RecipeInput[] = data.recipes;
          setBatchRecipes(list);
          setSelectedIndices(new Set(list.map((_, i) => i)));
        }
      } catch {
        setError(activeTab === "preppr" ? t("errorPrepprFile") : t("errorTandoorFile"));
      }
    });
  };

  const handlePasteJsonFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        let cleaned = text.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        }
        setPastedJson(cleaned);
        setError(null);
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const onImportJson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedJson.trim()) {
      setError(t("errorNoJson"));
      return;
    }

    setError(null);
    setSingleResult(null);
    setBatchRecipes(null);
    setBatchSuccessCount(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/import/json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: pastedJson, locale }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "generic" }));
          setError(
            data.error === "invalid-json"
              ? t("errorInvalidJson")
              : data.error === "no-recipes-found"
                ? t("errorNoRecipes")
                : t("errorPrepprFile"),
          );
          return;
        }

        const data = await res.json();
        if (data.type === "single") {
          setSingleResult({
            recipe: data.recipe,
            sourceType: data.recipe.sourceType || "manual",
            sourceUrl: data.recipe.sourceUrl,
          });
        } else if (data.type === "batch") {
          const list: RecipeInput[] = data.recipes;
          setBatchRecipes(list);
          setSelectedIndices(new Set(list.map((_, i) => i)));
        }
      } catch {
        setError(t("errorPrepprFile"));
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
            ← {activeTab === "photos" ? t("tabPhotos") : singleResult.sourceType === "youtube" || singleResult.sourceType === "website" ? t("tabYoutube") : singleResult.sourceType === "tandoor" ? t("tabTandoor") : t("tabPreppr")}
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
          availableTags={availableTags}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => switchTab("youtube")}
          className={cn(
            "rounded-lg py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium transition cursor-pointer text-center truncate",
            activeTab === "youtube"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-foreground/60 hover:text-foreground",
          )}
        >
          {t("tabYoutube")}
        </button>
        <button
          type="button"
          onClick={() => switchTab("photos")}
          className={cn(
            "rounded-lg py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium transition cursor-pointer text-center truncate flex items-center justify-center gap-1.5",
            activeTab === "photos"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-foreground/60 hover:text-foreground",
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-3.5 sm:size-4 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="truncate">{t("tabPhotos")}</span>
        </button>
        <button
          type="button"
          onClick={() => switchTab("preppr")}
          className={cn(
            "rounded-lg py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium transition cursor-pointer text-center truncate",
            activeTab === "preppr"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-foreground/60 hover:text-foreground",
          )}
        >
          {t("tabPreppr")}
        </button>
        <button
          type="button"
          onClick={() => switchTab("tandoor")}
          className={cn(
            "rounded-lg py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium transition cursor-pointer text-center truncate",
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

          {sharedNotice && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                {t("sharedLinkDetected")}
              </span>
              <button
                type="button"
                onClick={() => setSharedNotice(false)}
                className="text-emerald-600/70 hover:text-emerald-600 dark:text-emerald-400/70 dark:hover:text-emerald-400 cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="yt-url">{t("urlLabel")}</Label>
              {hasClipboard && (
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="text-xs font-medium text-foreground/60 hover:text-foreground flex items-center gap-1 transition cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-3.5"
                  >
                    <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V16.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 16.5v-13z" />
                    <path d="M4 6.5A1.5 1.5 0 015.5 5H6v9.5A2.5 2.5 0 008.5 17H14v.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 014 17.5v-11z" />
                  </svg>
                  {t("pasteFromClipboard")}
                </button>
              )}
            </div>
            <Input
              id="yt-url"
              value={ytUrl}
              onChange={(e) => {
                setYtUrl(e.target.value);
                if (sharedNotice) setSharedNotice(false);
              }}
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

      {/* Photo Scan Form */}
      {activeTab === "photos" && !batchRecipes && batchSuccessCount === null && (
        <div className="space-y-5 rounded-2xl border border-border bg-muted/10 p-5 sm:p-6">
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 text-foreground/70"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              {t("photosTitle")}
            </h2>
            <p className="text-xs sm:text-sm text-foreground/60">
              {t("photosDescription")}
            </p>
          </div>

          {/* Hidden inputs for gallery selection and direct camera capture */}
          <input
            ref={photoGalleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <input
            ref={photoCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(e.target.files);
                e.target.value = "";
              }
            }}
          />

          {selectedPhotos.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsPhotoDragging(true);
              }}
              onDragLeave={() => setIsPhotoDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsPhotoDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFilesAdded(e.dataTransfer.files);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition",
                isPhotoDragging
                  ? "border-foreground bg-muted/40"
                  : "border-border hover:border-foreground/40 bg-background/50",
              )}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground/70 shadow-inner">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="size-7"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t("photosDropzone")}
                </p>
                <p className="text-xs text-foreground/50 mt-1">{t("photosHint")}</p>
              </div>

              {/* Action Buttons for Mobile Camera & File Picker */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoCameraInputRef.current?.click()}
                  className="gap-1.5 h-10 px-4 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("takePhoto")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => photoGalleryInputRef.current?.click()}
                  className="gap-1.5 h-10 px-4 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.5 2A2.5 2.5 0 0 0 2 4.5v11A2.5 2.5 0 0 0 4.5 18h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 15.5 2h-11ZM11 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-4.5 7.5a.75.75 0 0 0 .75.75h5.5a.75.75 0 0 0 .75-.75v-1.086l-1.72-1.72a.75.75 0 0 0-1.06 0L9.5 11.94l-.72-.72a.75.75 0 0 0-1.06 0l-1.22 1.22v1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("choosePhotos")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                  {t("photosSelected", { count: selectedPhotos.length })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPhotos([]);
                    setPhotoPreviews([]);
                  }}
                  className="text-xs text-foreground/60 hover:text-red-500 font-medium transition cursor-pointer"
                >
                  {t("deselectAll")}
                </button>
              </div>

              {/* Photo preview grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedPhotos.map((photo, idx) => (
                  <div
                    key={`${photo.name}-${photo.size}-${idx}`}
                    className="relative group rounded-xl border border-border bg-background overflow-hidden shadow-xs aspect-4/3 flex flex-col justify-end"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreviews[idx]}
                      alt={`Photo ${idx + 1}`}
                      className="absolute inset-0 size-full object-cover"
                    />
                    <div className="relative z-10 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-xs">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="flex size-7 items-center justify-center rounded-full bg-black/60 hover:bg-red-600 text-white transition cursor-pointer"
                        aria-label={t("removePhoto")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="size-4"
                        >
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add More Slot if < 10 */}
                {selectedPhotos.length < 10 && (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/50 hover:border-foreground/30 p-3 aspect-4/3 text-center">
                    <span className="text-xs font-medium text-foreground/70">
                      {t("addMorePhotos")}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => photoCameraInputRef.current?.click()}
                        className="flex size-9 items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-foreground cursor-pointer transition shadow-xs"
                        title={t("addPhotoCamera")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="size-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => photoGalleryInputRef.current?.click()}
                        className="flex size-9 items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-foreground cursor-pointer transition shadow-xs"
                        title={t("choosePhotos")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="size-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.5 2A2.5 2.5 0 0 0 2 4.5v11A2.5 2.5 0 0 0 4.5 18h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 15.5 2h-11ZM11 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-4.5 7.5a.75.75 0 0 0 .75.75h5.5a.75.75 0 0 0 .75-.75v-1.086l-1.72-1.72a.75.75 0 0 0-1.06 0L9.5 11.94l-.72-.72a.75.75 0 0 0-1.06 0l-1.22 1.22v1.06Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Extract Recipe Action Button */}
              <Button
                type="button"
                className="w-full h-11 font-medium text-base gap-2 cursor-pointer mt-2"
                disabled={pending || selectedPhotos.length === 0}
                onClick={onExtractPhotos}
              >
                {pending ? (
                  <>
                    <Spinner />
                    <span>{t("extractingPhotos")}</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="size-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 1c3.866 0 7 3.134 7 7a6.977 6.977 0 0 1-1.636 4.485l4.343 4.343a1 1 0 0 1-1.414 1.414l-4.343-4.343A6.977 6.977 0 0 1 10 15a7 7 0 1 1 0-14Zm-5 7a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{t("extractPhotos")}</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {/* Preppr Form */}
      {activeTab === "preppr" && !batchRecipes && batchSuccessCount === null && (
        <div className="space-y-6">
          {/* Export Section */}
          <div className="rounded-2xl border border-border bg-muted/10 p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5 text-foreground/70"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {t("exportSectionTitle")}
              </h2>
              <p className="text-xs sm:text-sm text-foreground/60">{t("exportSectionDescription")}</p>
            </div>
            <div>
              <a href="/api/export" download className="inline-block">
                <Button type="button" className="h-11 font-medium gap-2">
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
                  {t("exportAllBtn")}
                </Button>
              </a>
            </div>
          </div>

          {/* Import Section */}
          <div className="rounded-2xl border border-border bg-muted/10 p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5 text-foreground/70"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t("importSectionTitle")}
              </h2>
              <p className="text-xs sm:text-sm text-foreground/60">{t("importSectionDescription")}</p>
            </div>

            {/* Sub-mode selector: Paste JSON vs File Upload */}
            <div className="flex rounded-lg border border-border bg-muted/20 p-1">
              <button
                type="button"
                onClick={() => setPrepprMode("paste")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition cursor-pointer text-center",
                  prepprMode === "paste"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                {t("prepprModePaste")}
              </button>
              <button
                type="button"
                onClick={() => setPrepprMode("file")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition cursor-pointer text-center",
                  prepprMode === "file"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                {t("prepprModeFile")}
              </button>
            </div>

            {prepprMode === "paste" ? (
              <form onSubmit={onImportJson} className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pasted-json" className="text-xs font-medium text-foreground/80">
                      {t("pasteJsonLabel")}
                    </Label>
                    {pastedJson.trim() && (
                      <span
                        className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                          isPastedJsonValid
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
                        )}
                      >
                        {isPastedJsonValid ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                            </svg>
                            {t("jsonValid")}
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3">
                              <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm2.78-9.72a.75.75 0 0 0-1.06-1.06L8 5.94 6.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 7 5.22 8.72a.75.75 0 0 0 1.06 1.06L8 8.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 7l1.72-1.72Z" clipRule="evenodd" />
                            </svg>
                            {t("jsonInvalid")}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  {hasClipboard && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePasteJsonFromClipboard}
                      className="h-8 gap-1.5 text-xs cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-3.5"
                      >
                        <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                        <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.439 6.44A1.5 1.5 0 0 0 8.38 6H4.5Z" />
                      </svg>
                      {t("pasteFromClipboard")}
                    </Button>
                  )}
                </div>

                <textarea
                  id="pasted-json"
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  rows={9}
                  placeholder={t("pasteJsonPlaceholder")}
                  className={cn(
                    "w-full rounded-xl border p-3 font-mono text-xs text-foreground placeholder:text-foreground/40 focus:outline-hidden resize-y transition",
                    pastedJson.trim()
                      ? isPastedJsonValid
                        ? "border-emerald-500/40 bg-emerald-500/5 focus:border-emerald-500"
                        : "border-red-500/40 bg-red-500/5 focus:border-red-500"
                      : "border-border bg-background/50 focus:border-foreground/40",
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 font-medium text-base gap-2 cursor-pointer"
                  disabled={pending || !isPastedJsonValid}
                >
                  {pending ? (
                    <>
                      <Spinner />
                      <span>{t("importingJson")}</span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 1c3.866 0 7 3.134 7 7a6.977 6.977 0 0 1-1.636 4.485l4.343 4.343a1 1 0 0 1-1.414 1.414l-4.343-4.343A6.977 6.977 0 0 1 10 15a7 7 0 1 1 0-14Zm-5 7a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{t("importJsonBtn")}</span>
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="pt-2">
                <input
                  ref={prepprFileInputRef}
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
                  onClick={() => prepprFileInputRef.current?.click()}
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
                      {pending ? t("uploading") : t("prepprFileDropzone")}
                    </p>
                    <p className="text-xs text-foreground/50 mt-1">{t("prepprFileHint")}</p>
                  </div>
                  {pending && <Spinner />}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
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
