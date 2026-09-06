"use client";

import { usePathname, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { type Locale } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const navItems = [
  {
    key: "recipes",
    href: "/",
    match: (p: string) => p === "/" || (p.startsWith("/recipes") && p !== "/recipes/new"),
  },
  {
    key: "import",
    href: "/import",
    match: (p: string) => p.startsWith("/import"),
  },
  {
    key: "new",
    href: "/recipes/new",
    match: (p: string) => p === "/recipes/new",
  },
] as const;

export function Navbar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground transition hover:opacity-80"
          >
            preppr
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    active
                      ? "bg-muted text-foreground font-semibold"
                      : "text-foreground/70 hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}
