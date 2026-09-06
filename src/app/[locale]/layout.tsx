import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { TabBar } from "@/components/tab-bar";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "preppr",
    description: locale === "de" ? "Rezepte & Meal Prep" : "Recipes & meal prep",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
            <span className="text-base font-semibold tracking-tight">preppr</span>
            <LocaleSwitcher locale={locale as Locale} />
          </header>
          <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
            {children}
          </main>
          <TabBar />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
