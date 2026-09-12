import Link from "next/link";
import { getInstanceLocale } from "@/i18n/routing";

export default function NotFound() {
  const locale = getInstanceLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="flex min-h-screen flex-col items-center justify-center p-4 text-center font-sans"
      >
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-zinc-500">
          {locale === "de" ? "Seite nicht gefunden" : "Page not found"}
        </p>
        <Link
          href={`/${locale}`}
          className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {locale === "de" ? "Zur Startseite" : "Back to Home"}
        </Link>
      </body>
    </html>
  );
}
