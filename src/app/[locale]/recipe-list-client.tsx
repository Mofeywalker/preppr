"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecipeWithTags } from "@/lib/recipes";
import Fuse from "fuse.js";

type SortOption =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "time-asc"
  | "calories-asc";

type ViewMode = "grid" | "list";

export function RecipeListClient({
  recipes,
  initialQuery = "",
  initialTags = [],
  initialFilter = "all",
}: {
  recipes: RecipeWithTags[];
  initialQuery?: string;
  initialTags?: string[];
  initialFilter?: "all" | "mine" | "shared";
}) {
  const t = useTranslations("Recipes");
  const tNav = useTranslations("Nav");
  const tSharing = useTranslations("Sharing");

  const [filter, setFilter] = useState<"all" | "mine" | "shared">(initialFilter);
  const [q, setQ] = useState(initialQuery);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract all unique tags with count
  const allTagsWithCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      if (r.tags) {
        for (const tag of r.tags) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes]);

  // Sync to URL via window.history.replaceState without triggering Next.js server transitions/flicker
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = q.trim();
      const url = new URL(window.location.href);
      const currentQ = url.searchParams.get("q") ?? "";
      const currentTags = url.searchParams.get("tags") ?? "";
      const newTags = selectedTags.join(",");

      let changed = false;
      if (trimmed !== currentQ) {
        if (trimmed) {
          url.searchParams.set("q", trimmed);
        } else {
          url.searchParams.delete("q");
        }
        changed = true;
      }
      if (newTags !== currentTags) {
        if (newTags) {
          url.searchParams.set("tags", newTags);
        } else {
          url.searchParams.delete("tags");
        }
        changed = true;
      }

      if (changed) {
        window.history.replaceState(null, "", url.toString());
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [q, selectedTags]);

  // Handle browser Back / Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setQ(params.get("q") ?? "");
      const tagsParam = params.get("tags");
      setSelectedTags(
        tagsParam
          ? tagsParam
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      );
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Global keyboard shortcut to focus search ("/” or Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isInput) return;

      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K"))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName],
    );
  };

  const clearAllFilters = () => {
    setQ("");
    setSelectedTags([]);
  };

  const filteredAndSorted = useMemo(() => {
    let result = recipes;

    // Filter by ownership/sharing scope
    if (filter === "mine") {
      result = result.filter((r) => r.isOwner);
    } else if (filter === "shared") {
      result = result.filter((r) => r.visibility === "shared" && !r.isOwner);
    }

    // Filter by selected tags (AND conjunction: must match all selected tags)
    if (selectedTags.length > 0) {
      result = result.filter((r) =>
        selectedTags.every((st) =>
          r.tags?.some((rt) => rt.toLowerCase() === st.toLowerCase()),
        ),
      );
    }

    // Filter by text search
    const trimmed = q.trim();
    if (trimmed) {
      const fuse = new Fuse(result, {
        keys: [
          { name: "title", weight: 0.7 },
          { name: "description", weight: 0.3 },
          { name: "tags", weight: 0.4 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 1,
      });
      result = fuse.search(trimmed).map((res) => res.item);
    }

    // Apply sorting
    const sorted = [...result];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "oldest":
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "title-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "time-asc":
        sorted.sort((a, b) => {
          const aTime = (a.prepTimeMin ?? 0) + (a.cookTimeMin ?? 0);
          const bTime = (b.prepTimeMin ?? 0) + (b.cookTimeMin ?? 0);
          return aTime - bTime;
        });
        break;
      case "calories-asc":
        sorted.sort((a, b) => (a.calories ?? 999999) - (b.calories ?? 999999));
        break;
    }

    return sorted;
  }, [q, recipes, selectedTags, sortBy, filter]);

  return (
    <div className="space-y-6">
      {/* Top Row: Title & Primary Actions */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p
            className="mt-0.5 text-xs sm:text-sm text-foreground/60"
            aria-live="polite"
            aria-atomic="true"
          >
            {t("count", { count: filteredAndSorted.length })}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {recipes.length > 0 && (
            <a href="/api/export" download>
              <Button variant="outline" size="sm" className="h-9 font-medium gap-1.5 hidden sm:inline-flex">
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
          )}
          <Link href="/recipes/new">
            <Button size="sm" className="h-9 font-medium gap-1">
              <span>+</span>
              <span>{tNav("new")}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Second Row: Scope Filter & Search/Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Scope Filter: All / My Recipes / Shared */}
        <div className="inline-flex h-9 self-start sm:self-auto items-center rounded-lg border border-input bg-muted/40 p-1 text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1 rounded-md transition cursor-pointer whitespace-nowrap",
              filter === "all"
                ? "bg-background shadow-xs text-foreground font-semibold"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {tSharing("filterAll")}
          </button>
          <button
            type="button"
            onClick={() => setFilter("mine")}
            className={cn(
              "px-3 py-1 rounded-md transition cursor-pointer whitespace-nowrap",
              filter === "mine"
                ? "bg-background shadow-xs text-foreground font-semibold"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {tSharing("filterMine")}
          </button>
          <button
            type="button"
            onClick={() => setFilter("shared")}
            className={cn(
              "px-3 py-1 rounded-md transition cursor-pointer whitespace-nowrap",
              filter === "shared"
                ? "bg-background shadow-xs text-foreground font-semibold"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {tSharing("filterShared")}
          </button>
        </div>

        {/* Search, Sort, and View Mode Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Search Box */}
          <label className="flex h-9 w-full sm:w-52 md:w-64 shrink-0 items-center gap-2 rounded-lg border border-input bg-background px-3 transition focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/10 cursor-text">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4 shrink-0 text-foreground/40 pointer-events-none"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder={t("search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/50 [&::-webkit-search-cancel-button]:hidden"
            />
            {q ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQ("");
                  inputRef.current?.focus();
                }}
                className="shrink-0 p-0.5 rounded-full text-foreground/40 hover:text-foreground hover:bg-muted transition cursor-pointer"
                aria-label={t("clearSearch")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-3.5"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            ) : (
              <kbd
                className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground/40 select-none pointer-events-none"
                title={t("searchShortcut")}
              >
                /
              </kbd>
            )}
          </label>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 rounded-lg border border-input bg-background px-3 pr-8 text-xs sm:text-sm font-medium text-foreground/80 focus:border-foreground focus:ring-2 focus:ring-foreground/10 cursor-pointer outline-none appearance-none"
              aria-label={t("sortBy")}
            >
              <option value="newest">{t("sortNewest")}</option>
              <option value="oldest">{t("sortOldest")}</option>
              <option value="title-asc">{t("sortTitleAsc")}</option>
              <option value="title-desc">{t("sortTitleDesc")}</option>
              <option value="time-asc">{t("sortTimeAsc")}</option>
              <option value="calories-asc">{t("sortCaloriesAsc")}</option>
            </select>
            <svg
              className="size-4 text-foreground/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Grid / List View Toggle */}
          <div className="inline-flex h-9 items-center rounded-lg border border-input bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition cursor-pointer",
                viewMode === "grid"
                  ? "bg-background shadow-xs text-foreground"
                  : "text-foreground/50 hover:text-foreground",
              )}
              title={t("viewGrid")}
              aria-label={t("viewGrid")}
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
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition cursor-pointer",
                viewMode === "list"
                  ? "bg-background shadow-xs text-foreground"
                  : "text-foreground/50 hover:text-foreground",
              )}
              title={t("viewList")}
              aria-label={t("viewList")}
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
                <line x1="8" x2="21" y1="6" y2="6" />
                <line x1="8" x2="21" y1="12" y2="12" />
                <line x1="8" x2="21" y1="18" y2="18" />
                <line x1="3" x2="3.01" y1="6" y2="6" />
                <line x1="3" x2="3.01" y1="12" y2="12" />
                <line x1="3" x2="3.01" y1="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Tag Filter Bar with smooth scroll */}
      {allTagsWithCount.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
          <button
            type="button"
            onClick={() => setSelectedTags([])}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition shrink-0 cursor-pointer",
              selectedTags.length === 0
                ? "bg-foreground text-background shadow-xs"
                : "bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground",
            )}
          >
            {t("allTags")}
          </button>
          {allTagsWithCount.map(({ name, count }) => {
            const isSelected = selectedTags.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleTag(name)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition shrink-0 cursor-pointer",
                  isSelected
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <span>{name}</span>
                <span
                  className={cn(
                    "text-[10px] rounded-full px-1.5 py-0.5 leading-none",
                    isSelected
                      ? "bg-background/20 text-background"
                      : "bg-foreground/10 text-foreground/60",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="text-xs text-foreground/60 hover:text-foreground underline ml-1 shrink-0 cursor-pointer"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      )}

      {/* Empty States */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-foreground/60">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-foreground/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <p className="font-medium text-foreground/80">
            {q.trim() || selectedTags.length > 0
              ? t("noFilteredResults")
              : t("empty")}
          </p>
          {q.trim() || selectedTags.length > 0 ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-3 inline-block font-medium text-foreground underline hover:opacity-80 cursor-pointer"
            >
              {t("clearFilters")}
            </button>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-3">
              <Link
                href="/recipes/new"
                className="font-medium text-foreground underline hover:opacity-80"
              >
                {t("addFirst")}
              </Link>
              <span className="text-foreground/30">•</span>
              <Link
                href="/import"
                className="font-medium text-foreground/70 underline hover:text-foreground"
              >
                {tNav("import")}
              </Link>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Accessible Card Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredAndSorted.map((r, idx) => {
            const totalTime = (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0);
            const hasImage = Boolean(r.imageUrl && !failedImages.has(r.id));
            // First two cards are above the fold (LCP candidates)
            const isPriority = idx < 2;

            return (
              <article
                key={r.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-background transition-all duration-200 hover:border-foreground/40 hover:shadow-sm"
              >
                {/* Image Container with LCP Prioritization & Error Fallback */}
                <div className="aspect-video w-full overflow-hidden bg-muted relative">
                  {hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl!}
                      alt={r.title}
                      fetchPriority={isPriority ? "high" : undefined}
                      loading={isPriority ? "eager" : "lazy"}
                      onError={() => setFailedImages((prev) => new Set(prev).add(r.id))}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-foreground/30 uppercase tracking-widest">
                      preppr
                    </div>
                  )}

                  {/* Source indicator badge */}
                  {r.sourceType && r.sourceType !== "manual" && (
                    <div className="absolute top-2.5 right-2.5 z-10 rounded-full bg-background/85 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-foreground/80 shadow-xs border border-border/40">
                      {r.sourceType === "youtube" ? "YouTube" : r.sourceType === "website" ? "Web" : "Tandoor"}
                    </div>
                  )}

                  {!r.isOwner && r.visibility === "shared" && (
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-primary text-primary-foreground backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium shadow-xs">
                      {r.authorImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.authorImage}
                          alt=""
                          className="size-3.5 rounded-full object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span>{r.authorName ? `${r.authorName}` : tSharing("sharedBadge")}</span>
                    </div>
                  )}
                </div>

                {/* Card Content with Stretched Link Pattern */}
                <div className="flex flex-1 flex-col justify-between p-4 gap-3">
                  <div>
                    <h2 className="font-semibold text-base tracking-tight line-clamp-2 text-balance group-hover:underline">
                      <Link
                        href={`/recipes/${r.id}`}
                        className="focus:outline-none after:absolute after:inset-0 after:content-['']"
                      >
                        {r.title}
                      </Link>
                    </h2>
                    {r.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-foreground/60 leading-relaxed text-pretty">
                        {r.description}
                      </p>
                    )}

                    {/* Tags with z-10 so they are independently interactive & accessible */}
                    {r.tags && r.tags.length > 0 && (
                      <div className="relative z-10 mt-2.5 flex flex-wrap gap-1">
                        {r.tags.slice(0, 3).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-medium transition cursor-pointer",
                              selectedTags.includes(tag)
                                ? "bg-foreground text-background"
                                : "bg-muted text-foreground/70 hover:bg-foreground/10 hover:text-foreground",
                            )}
                          >
                            #{tag}
                          </button>
                        ))}
                        {r.tags.length > 3 && (
                          <span className="rounded-md px-1 py-0.5 text-[10px] font-medium text-foreground/40">
                            +{r.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Metadata */}
                  <div className="relative z-10 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-foreground/50">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-3.5 opacity-60"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        {r.servings} {t("servings")}
                      </span>
                      {totalTime > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-3.5 opacity-60"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {totalTime} {t("minutes")}
                        </span>
                      )}
                    </div>
                    {r.calories != null && (
                      <span className="font-medium text-foreground/60">
                        {r.calories} {t("caloriesShort")}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Compact List View */
        <div className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border bg-background overflow-hidden">
          {filteredAndSorted.map((r, idx) => {
            const totalTime = (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0);
            const hasImage = Boolean(r.imageUrl && !failedImages.has(r.id));
            const isPriority = idx < 4;

            return (
              <article
                key={r.id}
                className="group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 transition-colors hover:bg-muted/40"
              >
                {/* Thumbnail */}
                <div className="size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl bg-muted relative">
                  {hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl!}
                      alt={r.title}
                      fetchPriority={isPriority ? "high" : undefined}
                      loading={isPriority ? "eager" : "lazy"}
                      onError={() => setFailedImages((prev) => new Set(prev).add(r.id))}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-foreground/30 uppercase tracking-widest">
                      preppr
                    </div>
                  )}
                </div>

                {/* Main Row Info */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold text-sm sm:text-base tracking-tight truncate group-hover:underline flex items-center gap-2">
                      <Link
                        href={`/recipes/${r.id}`}
                        className="focus:outline-none after:absolute after:inset-0 after:content-['']"
                      >
                        {r.title}
                      </Link>
                      {!r.isOwner && r.visibility === "shared" && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                          {r.authorImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.authorImage}
                              alt=""
                              className="size-3.5 rounded-full object-cover shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <span>{r.authorName ? `${r.authorName}` : tSharing("sharedBadge")}</span>
                        </span>
                      )}
                    </h2>
                    {r.calories != null && (
                      <span className="shrink-0 text-xs font-medium text-foreground/60">
                        {r.calories} {t("caloriesShort")}
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-foreground/60 text-pretty">
                      {r.description}
                    </p>
                  )}

                  {/* Metadata & Tags */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground/50">
                    <span className="inline-flex items-center gap-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-3 opacity-60"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                      {r.servings} {t("servings")}
                    </span>
                    {totalTime > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-3 opacity-60"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {totalTime} {t("minutes")}
                      </span>
                    )}
                    {r.sourceType && r.sourceType !== "manual" && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/60">
                        {r.sourceType === "youtube" ? "YouTube" : r.sourceType === "website" ? "Web" : "Tandoor"}
                      </span>
                    )}

                    {r.tags && r.tags.length > 0 && (
                      <div className="relative z-10 flex items-center gap-1">
                        {r.tags.slice(0, 4).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium transition cursor-pointer",
                              selectedTags.includes(tag)
                                ? "bg-foreground text-background"
                                : "bg-muted text-foreground/70 hover:bg-foreground/10 hover:text-foreground",
                            )}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
