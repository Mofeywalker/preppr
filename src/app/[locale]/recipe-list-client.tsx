"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/lib/recipes";
import Fuse from "fuse.js";

export function RecipeListClient({
  recipes,
  initialQuery = "",
}: {
  recipes: Recipe[];
  initialQuery?: string;
}) {
  const t = useTranslations("Recipes");
  const tNav = useTranslations("Nav");

  const [q, setQ] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync to URL via window.history.replaceState without triggering Next.js server transitions/flicker
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = q.trim();
      const url = new URL(window.location.href);
      const currentParam = url.searchParams.get("q") ?? "";
      if (trimmed !== currentParam) {
        if (trimmed) {
          url.searchParams.set("q", trimmed);
        } else {
          url.searchParams.delete("q");
        }
        window.history.replaceState(null, "", url.toString());
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [q]);

  // Handle browser Back / Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const param = new URLSearchParams(window.location.search).get("q") ?? "";
      setQ(param);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Setup Fuse.js for fuzzy matching across title and description
  const fuse = useMemo(
    () =>
      new Fuse(recipes, {
        keys: [
          { name: "title", weight: 0.7 },
          { name: "description", weight: 0.3 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 1,
      }),
    [recipes],
  );

  const filtered = useMemo(() => {
    const trimmed = q.trim();
    if (!trimmed) return recipes;
    return fuse.search(trimmed).map((res) => res.item);
  }, [q, recipes, fuse]);

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
          <div className="relative w-full sm:w-72 shrink-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-foreground/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <Input
              ref={inputRef}
              type="text"
              autoComplete="off"
              placeholder={t("search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 bg-background pl-9 pr-9"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-foreground/40 hover:text-foreground transition cursor-pointer"
                aria-label={t("clearSearch")}
              >
                <span className="flex size-5 items-center justify-center rounded-full hover:bg-muted transition">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-3.5"
                  >
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </span>
              </button>
            )}
          </div>
          <Link href="/recipes/new" className="hidden sm:inline-flex">
            <Button size="sm" className="h-10 font-medium">
              + {tNav("new")}
            </Button>
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-foreground/60">
          <p className="font-medium text-foreground/80">
            {q.trim() ? t("noResults", { query: q.trim() }) : t("empty")}
          </p>
          {q.trim() ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="mt-3 inline-block font-medium text-foreground underline hover:opacity-80 cursor-pointer"
            >
              {t("clearSearch")}
            </button>
          ) : (
            <Link
              href="/recipes/new"
              className="mt-3 inline-block font-medium text-foreground underline hover:opacity-80"
            >
              {t("addFirst")}
            </Link>
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

