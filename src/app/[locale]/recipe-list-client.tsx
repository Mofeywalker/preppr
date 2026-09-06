"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/inputs";
import type { Recipe } from "@/lib/recipes";

export function RecipeListClient({ recipes }: { recipes: Recipe[] }) {
  const t = useTranslations("Recipes");
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? recipes.filter((r) =>
        (r.title + " " + (r.description ?? "")).toLowerCase().includes(q.toLowerCase()),
      )
    : recipes;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
      <Input
        placeholder={t("search")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/60">
          <p>{t("empty")}</p>
          <Link
            href="/recipes/new"
            className="mt-2 inline-block font-medium text-foreground underline"
          >
            {t("addFirst")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/recipes/${r.id}`}
                className="flex gap-3 rounded-xl border border-border p-3 transition hover:border-foreground/40"
              >
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.imageUrl}
                    alt={r.title}
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-16 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  {r.description && (
                    <p className="line-clamp-2 text-xs text-foreground/60">
                      {r.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-foreground/50">
                    {r.servings} {t("servings")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
