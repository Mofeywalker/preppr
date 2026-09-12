import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { listAllTags } from "@/lib/recipes";
import { extractUrlFromShareData } from "@/lib/urls";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = searchParams ? await searchParams : {};
  const rawUrl = typeof sp.url === "string" ? sp.url : Array.isArray(sp.url) ? sp.url[0] : "";
  const rawText = typeof sp.text === "string" ? sp.text : Array.isArray(sp.text) ? sp.text[0] : "";
  const initialUrl = extractUrlFromShareData(rawUrl, rawText);

  const availableTags = await listAllTags();
  return (
    <ImportClient
      locale={locale as Locale}
      availableTags={availableTags}
      initialUrl={initialUrl}
    />
  );
}
