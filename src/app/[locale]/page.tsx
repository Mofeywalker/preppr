import { listRecipes } from "@/lib/recipes";
import { RecipeListClient } from "./recipe-list-client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tags?: string; filter?: "all" | "mine" | "shared" }>;
}) {
  await params;
  const { q, tags, filter } = await searchParams;
  const session = await getSession();
  const recipes = await listRecipes(session?.user.id, filter ?? "all");
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
      initialFilter={filter ?? "all"}
    />
  );
}
