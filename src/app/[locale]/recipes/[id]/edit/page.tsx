import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/recipes";
import { RecipeForm, recipeFormInitialFromFull } from "@/components/recipe-form";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { id, locale } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return (
    <div className="space-y-3">
      <RecipeForm
        mode="edit"
        recipeId={id}
        sourceType={recipe.sourceType}
        sourceUrl={recipe.sourceUrl}
        locale={locale}
        initial={recipeFormInitialFromFull(recipe)}
      />
    </div>
  );
}
