"use client";

import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { type Locale } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";
import { authClient, useSession } from "@/lib/auth-client";

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
  const router = useRouter();
  const tNav = useTranslations("Nav");
  const tAuth = useTranslations("Auth");
  const { data: session } = useSession();

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitials = session?.user?.name
    ? session.user.name.slice(0, 2).toUpperCase()
    : session?.user?.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : "U";

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
          {!isAuthPage && (
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
                    {tNav(item.key)}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />

          {!isAuthPage && session?.user && (
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <div
                className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                title={session.user.name || session.user.email}
              >
                {userInitials}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title={tAuth("signOut")}
              >
                {tAuth("signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
