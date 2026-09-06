"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/inputs";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Locale");

  return (
    <Select
      aria-label="Locale"
      value={locale}
      className="h-9 w-28 text-xs"
      onChange={(e) => {
        const next = e.target.value as Locale;
        router.replace(pathname, { locale: next });
      }}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {t(l)}
        </option>
      ))}
    </Select>
  );
}
