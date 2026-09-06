import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground/80", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
