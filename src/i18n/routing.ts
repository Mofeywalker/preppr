import { defineRouting } from "next-intl/routing";

export type SupportedLocale = "de" | "en";

export function getInstanceLocale(): SupportedLocale {
  const envLocale = (
    process.env.APP_LOCALE ||
    process.env.NEXT_PUBLIC_APP_LOCALE ||
    process.env.APP_LANGUAGE ||
    process.env.DEFAULT_LOCALE ||
    ""
  )
    .toLowerCase()
    .trim();

  if (envLocale === "en" || envLocale.startsWith("en")) {
    return "en";
  }
  return "de";
}

export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: getInstanceLocale(),
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

