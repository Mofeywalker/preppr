"use client";

import { useState } from "react";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { authClient, useSession } from "@/lib/auth-client";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

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

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const tNav = useTranslations("Nav");
  const tAuth = useTranslations("Auth");
  const { data: session } = useSession();

  const [imageError, setImageError] = useState(false);

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
            className="flex items-center transition hover:opacity-80"
          >
            <Logo size="md" />
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

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {!isAuthPage && session?.user && (
            <div className="flex items-center gap-2">
              {session.user.image && !imageError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name || session.user.email || ""}
                  onError={() => setImageError(true)}
                  className="size-8 rounded-full object-cover border border-border shrink-0"
                  referrerPolicy="no-referrer"
                  title={session.user.name || session.user.email}
                />
              ) : (
                <div
                  className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0"
                  title={session.user.name || session.user.email}
                >
                  {userInitials}
                </div>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-lg p-1.5 sm:px-2.5 sm:py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
                title={tAuth("signOut")}
                aria-label={tAuth("signOut")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 shrink-0 sm:hidden"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="hidden sm:inline">{tAuth("signOut")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
