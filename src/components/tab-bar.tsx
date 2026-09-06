"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const tabs = [
  {
    key: "recipes",
    href: "/",
    match: (p: string) => p === "/" || (p.startsWith("/recipes") && p !== "/recipes/new"),
  },
  { key: "import", href: "/import", match: (p: string) => p.startsWith("/import") },
  { key: "new", href: "/recipes/new", match: (p: string) => p === "/recipes/new" },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition",
                active ? "text-foreground" : "text-foreground/50",
              )}
            >
              <span className="size-5 rounded-full bg-current opacity-80" />
              {t(tab.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
