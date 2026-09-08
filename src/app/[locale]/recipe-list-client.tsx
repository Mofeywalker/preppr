"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecipeWithTags } from "@/lib/recipes";
import Fuse from "fuse.js";

export function RecipeListClient({
  recipes,
  initialQuery = "",
  initialTags = [],
}: {
  recipes: RecipeWithTags[];
  initialQuery?: string;
  initialTags?: string[];
}) {
  const t = useTranslations("Recipes");
  const tNav = useTranslations("Nav");

  const [q, setQ] = useState(initialQuery);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
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

  const filtered = useMemo(() => {
    let result = recipes;

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
      return fuse.search(trimmed).map((res) => res.item);
    }

    return result;
  }, [q, recipes, selectedTags]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-foreground/60">
            {t("count", { count: filtered.length })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex h-10 w-full sm:w-72 shrink-0 items-center gap-2 rounded-lg border border-input bg-background px-3 transition focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/10 cursor-text">
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
              type="text"
              autoComplete="off"
              placeholder={t("search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/50 disabled:opacity-50"
            />
            {q && (
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
            )}
          </label>
          {recipes.length > 0 && (
            <a href="/api/export" download>
              <Button variant="outline" size="sm" className="h-10 font-medium gap-1.5 hidden sm:inline-flex">
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
          <Link href="/recipes/new" className="hidden sm:inline-flex">
            <Button size="sm" className="h-10 font-medium">
              + {tNav("new")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Tag Filter Bar */}
      {allTagsWithCount.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
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
              className="text-xs text-foreground/60 hover:text-foreground underline ml-1 cursor-pointer"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-foreground/60">
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/recipes/${r.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background transition-all hover:border-foreground/40 hover:shadow-sm"
            >
              <div className="aspect-video w-full overflow-hidden bg-muted relative">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.imageUrl}
                    alt={r.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-foreground/30 uppercase tracking-widest">
                    preppr
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between p-4 gap-3">
                <div>
                  <h2 className="font-semibold text-base tracking-tight truncate group-hover:underline">
                    {r.title}
                  </h2>
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/60 leading-relaxed">
                      {r.description}
                    </p>
                  )}
                  {r.tags && r.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {r.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleTag(tag);
                          }}
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-medium transition cursor-pointer",
                            selectedTags.includes(tag)
                              ? "bg-foreground text-background"
                              : "bg-muted text-foreground/70 hover:bg-foreground/10 hover:text-foreground",
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                      {r.tags.length > 3 && (
                        <span className="rounded-md px-1 py-0.5 text-[10px] font-medium text-foreground/40">
                          +{r.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-foreground/50">
                  <span>
                    {r.servings} {t("servings")}
                  </span>
                  {(r.prepTimeMin != null || r.cookTimeMin != null) && (
                    <span>
                      {(r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0)} {t("minutes")}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


