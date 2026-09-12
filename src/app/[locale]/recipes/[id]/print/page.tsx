import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/recipes";
import { getSession } from "@/lib/auth";
import { RecipePrintClient } from "./recipe-print-client";

export const dynamic = "force-dynamic";

export default async function RecipePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ servings?: string; autoPrint?: string }>;
}) {
  const { id } = await params;
  const { servings: rawServings, autoPrint: rawAutoPrint } = await searchParams;
  const session = await getSession();
  const recipe = await getRecipe(id, session?.user.id);

  if (!recipe) notFound();

  const parsedServings = rawServings ? parseInt(rawServings, 10) : recipe.servings;
  const initialServings = Number.isFinite(parsedServings) && parsedServings > 0
    ? parsedServings
    : recipe.servings;

  const autoPrint = rawAutoPrint === "1" || rawAutoPrint === "true";

  return (
    <RecipePrintClient
      recipe={recipe}
      initialServings={initialServings}
      autoPrint={autoPrint}
    />
  );
}
