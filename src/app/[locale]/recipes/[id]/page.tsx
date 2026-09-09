import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/recipes";
import { RecipeDetailClient } from "./recipe-detail-client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const recipe = await getRecipe(id, session?.user.id);
  if (!recipe) notFound();
  return <RecipeDetailClient recipe={recipe} />;
}
