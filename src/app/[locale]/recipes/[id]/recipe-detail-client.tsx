"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FullRecipe } from "@/lib/recipes";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function RecipeDetailClient({ recipe }: { recipe: FullRecipe }) {
  const t = useTranslations("RecipeDetail");
  const tForm = useTranslations("Recipes");
  const tSharing = useTranslations("Sharing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [servings, setServings] = useState(recipe.servings);
  const [isCooked, setIsCooked] = useState(recipe.isCooked ?? false);
  const [toggleCookedLoading, setToggleCookedLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(recipe.imageUrl);
  const [prevRecipeImageUrl, setPrevRecipeImageUrl] = useState(recipe.imageUrl);
  const [forking, setForking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (recipe.imageUrl !== prevRecipeImageUrl) {
    setPrevRecipeImageUrl(recipe.imageUrl);
    setImageUrl(recipe.imageUrl);
    setImgError(false);
  }

  const scale = servings / recipe.servings;

  const onToggleCooked = async () => {
    const nextState = !isCooked;
    setIsCooked(nextState);
    setToggleCookedLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/cooked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCooked: nextState }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIsCooked(data.isCooked);
      router.refresh();
    } catch {
      setIsCooked(!nextState);
      setActionError(t("generic", { defaultValue: "Failed to update status" }));
    } finally {
      setToggleCookedLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      startTransition(() => {
        router.push("/");
      });
    } catch {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setActionError(t("deleteError", { defaultValue: "Failed to delete recipe" }));
    }
  };

  const onFork = async () => {
    setForking(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/fork`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      router.push(`/recipes/${data.id}`);
      router.refresh();
    } catch {
      setActionError("Failed to copy recipe");
    } finally {
      setForking(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/recipes/${recipe.id}/image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("uploadImage"));
      }
      const { url } = await res.json();
      if (url) {
        setImageUrl(url);
        setImgError(false);
        router.refresh();
      }
    } catch (err) {
      setUploadError((err as Error).message || t("uploadImage"));
    } finally {
      setUploading(false);
    }
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("generateImageError"));
      }
      const { url } = await res.json();
      setImageUrl(url);
      setImgError(false);
      router.refresh();
    } catch (err) {
      setGenError((err as Error).message || t("generateImageError"));
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top navigation & action buttons */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4 gap-3">
        <Link
          href="/"
          className="text-sm font-medium text-foreground/60 hover:text-foreground transition inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
        >
          <ChevronLeftIcon className="size-4" />
          <span>{t("back")}</span>
        </Link>

        {/* Desktop buttons (sm and above) */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Visibility / Author status badge */}
          {recipe.isOwner ? (
            <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/70">
              {recipe.visibility === "shared"
                ? tSharing("visibilityShared")
                : tSharing("visibilityPrivate")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {recipe.authorImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recipe.authorImage}
                  alt=""
                  className="size-4 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <span>
                {recipe.authorName
                  ? tSharing("sharedBy", { name: recipe.authorName })
                  : tSharing("sharedBadge")}
              </span>
            </span>
          )}

          {/* Cooked & Approved button (desktop) */}
          <button
            type="button"
            onClick={onToggleCooked}
            disabled={toggleCookedLoading}
            title={isCooked ? t("unmarkCooked") : t("markCooked")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer border",
              isCooked
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
                : "border-input bg-background text-foreground/70 hover:bg-muted hover:text-foreground",
            )}
          >
            {toggleCookedLoading ? (
              <Spinner />
            ) : isCooked ? (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
            ) : (
              <span>🍳</span>
            )}
            <span>{isCooked ? t("cookedBadge") : t("markCooked")}</span>
          </button>

          <Link href={`/recipes/${recipe.id}/print?servings=${servings}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
            >
              <PrinterIcon className="size-4" />
              <span>{t("printCard")}</span>
            </Button>
          </Link>

          <a href={`/api/recipes/${recipe.id}/export`} download>
            <Button variant="outline" size="sm" className="gap-1.5">
              <DownloadIcon className="size-4" />
              <span>{t("export")}</span>
            </Button>
          </a>

          {!recipe.isOwner ? (
            <Button
              variant="default"
              size="sm"
              onClick={onFork}
              disabled={forking}
              className="gap-1.5"
            >
              <CopyIcon className="size-4" />
              <span>{forking ? tSharing("forking") : tSharing("fork")}</span>
            </Button>
          ) : (
            <>
              <Link href={`/recipes/${recipe.id}/edit`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <PencilIcon className="size-4" />
                  <span>{t("edit")}</span>
                </Button>
              </Link>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isDeleting}
                className="gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Spinner /> : <TrashIcon className="size-4" />}
                <span>{t("delete")}</span>
              </Button>
            </>
          )}
        </div>

        {/* Mobile actions (< sm) */}
        <div className="flex sm:hidden items-center gap-2">
          {/* Mobile Cooked toggle */}
          <button
            type="button"
            onClick={onToggleCooked}
            disabled={toggleCookedLoading}
            aria-label={isCooked ? t("unmarkCooked") : t("markCooked")}
            className={cn(
              "inline-flex items-center justify-center size-9 rounded-lg border transition cursor-pointer shrink-0 text-sm",
              isCooked
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "border-input bg-background text-foreground/70 hover:bg-muted",
            )}
          >
            {toggleCookedLoading ? (
              <Spinner />
            ) : isCooked ? (
              <span className="font-bold">✓</span>
            ) : (
              <span>🍳</span>
            )}
          </button>

          {!recipe.isOwner ? (
            <Button
              variant="default"
              size="sm"
              onClick={onFork}
              disabled={forking}
              className="gap-1.5 h-9"
            >
              <CopyIcon className="size-3.5" />
              <span>{forking ? tSharing("forking") : tSharing("fork")}</span>
            </Button>
          ) : (
            <Link href={`/recipes/${recipe.id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <PencilIcon className="size-3.5" />
                <span>{t("edit")}</span>
              </Button>
            </Link>
          )}

          {/* Overflow Menu */}
          <div ref={menuRef} className="relative inline-block">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={t("moreActions")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="size-9 p-0"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>

            {menuOpen && (
              <div
                role="menu"
                aria-orientation="vertical"
                className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-border bg-background/95 backdrop-blur-md p-1 shadow-lg z-50 animate-in fade-in-50 zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleCooked();
                  }}
                  disabled={toggleCookedLoading}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition cursor-pointer text-left"
                >
                  <span className="text-sm">{isCooked ? "✓" : "🍳"}</span>
                  <span>{isCooked ? t("unmarkCooked") : t("markCooked")}</span>
                </button>

                <Link
                  href={`/recipes/${recipe.id}/print?servings=${servings}`}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                >
                  <PrinterIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("printCard")}</span>
                </Link>

                <a
                  href={`/api/recipes/${recipe.id}/export`}
                  download
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition cursor-pointer"
                >
                  <DownloadIcon className="size-4 shrink-0 text-foreground/70" />
                  <span>{t("export")}</span>
                </a>

                {recipe.isOwner && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={isDeleting}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-500/10 transition cursor-pointer text-left"
                  >
                    <TrashIcon className="size-4 shrink-0 text-red-600" />
                    <span>{t("delete")}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Media, Servings scaler, Nutrition, Source (sticky on desktop) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          <div className="overflow-hidden rounded-2xl border border-border bg-muted relative group">
            {imageUrl && !imgError ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={recipe.title}
                  onError={() => setImgError(true)}
                  className="aspect-video w-full object-cover"
                />
                {recipe.isOwner && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title={t("changeImage")}
                    className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/80 transition shadow-sm cursor-pointer"
                  >
                    {uploading ? (
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
                        className="size-3.5"
                      >
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                        <circle cx="12" cy="13" r="3" />
                      </svg>
                    )}
                    <span>{uploading ? t("uploadingImage") : t("changeImage")}</span>
                  </button>
                )}
              </>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 p-6 text-center">
                {recipe.isOwner ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || genLoading}
                      className="gap-2 cursor-pointer"
                    >
                      {uploading ? (
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
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      )}
                      <span>{uploading ? t("uploadingImage") : t("uploadImage")}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onGenerate}
                      disabled={uploading || genLoading}
                    >
                      {genLoading ? <Spinner /> : t("generateImage")}
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-foreground/30 uppercase tracking-widest">
                    preppr
                  </span>
                )}
              </div>
            )}
            {recipe.isOwner && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUpload}
              />
            )}
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          {genError && <p className="text-xs text-red-600">{genError}</p>}
          {actionError && (
            <div className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="font-bold ml-2 cursor-pointer hover:opacity-70 text-sm leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

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
            {/* Cooked & Approved Status Banner */}
            {isCooked ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-300 mb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
                    ✓
                  </span>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold leading-tight">{t("cookedBadge")}</p>
                    <p className="text-[11px] sm:text-xs text-emerald-700/80 dark:text-emerald-400/80 leading-tight mt-0.5">
                      {t("cookedHint")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleCooked}
                  disabled={toggleCookedLoading}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 underline hover:opacity-80 transition cursor-pointer shrink-0 ml-2"
                >
                  {t("unmarkCooked")}
                </button>
              </div>
            ) : (
              <div className="mb-3.5">
                <button
                  type="button"
                  onClick={onToggleCooked}
                  disabled={toggleCookedLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/50 px-3.5 py-2 text-xs font-medium text-foreground/70 hover:text-foreground transition cursor-pointer"
                >
                  {toggleCookedLoading ? <Spinner /> : <span>🍳</span>}
                  <span>{t("markCooked")}</span>
                  <span className="text-[11px] text-foreground/40 hidden sm:inline">• {t("cookedHint")}</span>
                </button>
              </div>
            )}

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

            {recipe.tags && recipe.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {recipe.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/?tags=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground px-2.5 py-0.5 text-xs font-medium transition cursor-pointer"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
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

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!isDeleting) setDeleteDialogOpen(false);
        }}
        onConfirm={handleDeleteConfirm}
        title={t("deleteConfirmTitle", { defaultValue: t("deleteConfirm") })}
        description={t("deleteConfirmDesc", {
          defaultValue:
            "Möchtest du dieses Rezept wirklich unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
        })}
        confirmText={
          isDeleting
            ? t("deleting", { defaultValue: "Wird gelöscht…" })
            : t("delete")
        }
        cancelText={t("cancel", { defaultValue: "Abbrechen" })}
        variant="danger"
        isPending={isDeleting}
      />
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
    <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5">
      <span className="text-foreground/70 truncate">{label}</span>
      <span className="font-medium shrink-0">
        {value == null ? t("nutritionUnknown") : `${value} ${unit}`}
      </span>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function MoreHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}
