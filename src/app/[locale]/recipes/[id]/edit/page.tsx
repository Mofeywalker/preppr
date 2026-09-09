import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getRecipe, listAllTags } from "@/lib/recipes";
import { RecipeForm } from "@/components/recipe-form";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { id, locale } = await params;
  const session = await getSession();
  const [recipe, availableTags, t] = await Promise.all([
    getRecipe(id, session?.user.id),
    listAllTags(),
    getTranslations("RecipeDetail"),
  ]);
  if (!recipe || !recipe.isOwner) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
        {t("edit")}: {recipe.title}
      </h1>
      <RecipeForm
        mode="edit"
        recipeId={id}
        sourceType={recipe.sourceType}
        sourceUrl={recipe.sourceUrl}
        locale={locale}
        recipe={recipe}
        availableTags={availableTags}
      />
    </div>
  );
}
