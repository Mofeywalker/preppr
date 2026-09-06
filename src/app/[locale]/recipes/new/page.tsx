import { getTranslations } from "next-intl/server";
import { RecipeForm } from "@/components/recipe-form";
import type { Locale } from "@/i18n/routing";

export default async function NewRecipePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("New");
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
      <RecipeForm mode="create" sourceType="manual" locale={locale} />
    </div>
  );
}
