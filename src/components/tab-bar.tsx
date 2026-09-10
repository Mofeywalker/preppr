"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function ImportIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

const tabs = [
  {
    key: "recipes",
    href: "/",
    match: (p: string) => p === "/" || (p.startsWith("/recipes") && p !== "/recipes/new"),
    icon: BookOpenIcon,
  },
  {
    key: "import",
    href: "/import",
    match: (p: string) => p.startsWith("/import"),
    icon: ImportIcon,
  },
  {
    key: "new",
    href: "/recipes/new",
    match: (p: string) => p === "/recipes/new",
    icon: PlusCircleIcon,
  },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto flex max-w-md items-stretch">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition",
                active ? "text-foreground font-semibold" : "text-foreground/50 hover:text-foreground/80",
              )}
            >
              <Icon className={cn("size-5 transition-transform", active ? "scale-110" : "opacity-70")} />
              <span>{t(tab.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
