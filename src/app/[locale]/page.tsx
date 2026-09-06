import { listRecipes } from "@/lib/recipes";
import { RecipeListClient } from "./recipe-list-client";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const recipes = await listRecipes();
  return <RecipeListClient recipes={recipes} />;
}
