import { listRecipes } from "@/lib/recipes";
import { RecipeListClient } from "./recipe-list-client";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tags?: string }>;
}) {
  await params;
  const { q, tags } = await searchParams;
  const recipes = await listRecipes();
  const initialTags = tags
    ? tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  return (
    <RecipeListClient
      recipes={recipes}
      initialQuery={q ?? ""}
      initialTags={initialTags}
    />
  );
}
