import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { Navbar } from "@/components/navbar";
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
          <Navbar locale={locale as Locale} />
          <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12">
            {children}
          </main>
          <TabBar />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
