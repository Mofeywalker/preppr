import { getTranslations } from "next-intl/server";
import { RecipeForm } from "@/components/recipe-form";
import { listAllTags } from "@/lib/recipes";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function NewRecipePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const [t, availableTags] = await Promise.all([
    getTranslations("New"),
    listAllTags(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
      <RecipeForm
        mode="create"
        sourceType="manual"
        locale={locale}
        availableTags={availableTags}
      />
    </div>
  );
}
