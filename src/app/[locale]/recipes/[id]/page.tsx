import { notFound } from "next/navigation";
import { listRecipeComments } from "@/lib/recipe-comments";
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
  if (!recipe || (!session && recipe.visibility === "private")) notFound();
  const canShowComments = recipe.visibility === "shared" || !!recipe.userId;
  const displayRecipe = session ? recipe : { ...recipe, isOwner: false, canEdit: false };
  const comments = canShowComments ? await listRecipeComments(id) : [];
  return (
    <RecipeDetailClient
      recipe={displayRecipe}
      comments={comments}
      viewerId={session?.user.id ?? null}
      canShowComments={canShowComments}
    />
  );
}
