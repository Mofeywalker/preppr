"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

function SunIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
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
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
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
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("Theme");
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const options: Array<{ value: Theme; label: string; icon: typeof SunIcon }> = [
    { value: "light", label: t("light"), icon: SunIcon },
    { value: "dark", label: t("dark"), icon: MoonIcon },
    { value: "system", label: t("system"), icon: MonitorIcon },
  ];

  const handleSelect = (newTheme: Theme) => {
    setTheme(newTheme);
    setOpen(false);
  };

  // Active icon based on user theme setting (or resolved if light/dark)
  const CurrentIcon =
    theme === "system"
      ? MonitorIcon
      : resolvedTheme === "dark"
      ? MoonIcon
      : SunIcon;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("toggle")}
        aria-haspopup="menu"
        aria-expanded={open}
        suppressHydrationWarning
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground/80 transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 cursor-pointer",
          open && "bg-muted text-foreground ring-2 ring-foreground/20",
        )}
      >
        <CurrentIcon className="size-4 shrink-0 transition-transform duration-200" />
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-38 origin-top-right rounded-xl border border-border bg-background p-1 shadow-lg backdrop-blur-md z-50 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {options.map(({ value, label, icon: Icon }) => {
            const isSelected = theme === value;
            return (
              <button
                key={value}
                role="menuitem"
                type="button"
                onClick={() => handleSelect(value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer text-left",
                  isSelected
                    ? "bg-muted text-foreground font-semibold"
                    : "text-foreground/70 hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0" />
                  <span>{label}</span>
                </div>
                {isSelected && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
