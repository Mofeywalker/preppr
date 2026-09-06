import { listRecipes } from "@/lib/recipes";
import { RecipeListClient } from "./recipe-list-client";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await params;
  const { q } = await searchParams;
  const recipes = await listRecipes();
  return <RecipeListClient recipes={recipes} initialQuery={q ?? ""} />;
}
