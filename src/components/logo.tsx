import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg" | "xl" | number;
  showText?: boolean;
  iconClassName?: string;
  textClassName?: string;
}

const sizeConfig = {
  sm: { icon: 20, text: "text-base", gap: "gap-2" },
  md: { icon: 24, text: "text-lg", gap: "gap-2.5" },
  lg: { icon: 32, text: "text-2xl", gap: "gap-3" },
  xl: { icon: 44, text: "text-3xl", gap: "gap-3.5" },
};

export function LogoIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* P-Stem: Solid vertical container pillar */}
      <rect
        x="10"
        y="10"
        width="9"
        height="44"
        rx="4.5"
        fill="currentColor"
      />

      {/* Top Prep Compartment (Lid) */}
      <path
        d="M22 10H42C48.0751 10 53 14.9249 53 19.5C53 20.3284 52.3284 21 51.5 21H22V10Z"
        fill="currentColor"
      />

      {/* Bottom Prep Compartment */}
      <path
        d="M22 23.5H51.5C52.3284 23.5 53 24.1716 53 25C53 29.5751 48.0751 34.5 42 34.5H22V23.5Z"
        fill="currentColor"
      />

      {/* Freshness Accent: Emerald Green Dot */}
      <circle
        cx="42.5"
        cy="22.25"
        r="3"
        fill="#10B981"
      />
    </svg>
  );
}

export function Logo({
  size = "md",
  showText = true,
  className,
  iconClassName,
  textClassName,
  ...props
}: LogoProps) {
  const isPreset = typeof size === "string";
  const config = isPreset ? sizeConfig[size] : { icon: size, text: "text-lg", gap: "gap-2.5" };

  return (
    <div
      className={cn("inline-flex items-center select-none", config.gap, className)}
      {...props}
    >
      <LogoIcon size={config.icon} className={iconClassName} />
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight text-foreground transition",
            config.text,
            textClassName
          )}
        >
          preppr
        </span>
      )}
    </div>
  );
}
