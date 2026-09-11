import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/navbar";
import { TabBar } from "@/components/tab-bar";
import { PwaClient } from "@/components/pwa-client";
import { ThemeProvider } from "@/components/theme-provider";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "preppr",
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "32x32" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('preppr-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||((!s||s==='system')&&m);var r=document.documentElement;if(d){r.classList.add('dark');r.classList.remove('light');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.classList.add('light');r.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <PwaClient />
            <Navbar />
            <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-12">
              {children}
            </main>
            <TabBar />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
