"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/lib/recipes";

export function RecipeListClient({ recipes }: { recipes: Recipe[] }) {
  const t = useTranslations("Recipes");
  const tNav = useTranslations("Nav");
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? recipes.filter((r) =>
        (r.title + " " + (r.description ?? "")).toLowerCase().includes(q.toLowerCase()),
      )
    : recipes;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-foreground/60">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder={t("search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 bg-background"
            />
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
          <p className="font-medium text-foreground/80">{t("empty")}</p>
          <Link
            href="/recipes/new"
            className="mt-3 inline-block font-medium text-foreground underline hover:opacity-80"
          >
            {t("addFirst")}
          </Link>
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

