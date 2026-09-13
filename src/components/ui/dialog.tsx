"use client";

import { useEffect, useRef, useId, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Fallback if showModal fails in unsupported test environments
          dialog.setAttribute("open", "");
        }
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  // Handle native cancel event (triggered by Escape key)
  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement, Event>) => {
    e.preventDefault();
    onClose();
  };

  // Fallback for browsers that do not support declarative `closedby="any"`
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Only process when click occurred directly on the dialog backdrop
    if (e.target !== dialog) return;

    // Check if browser already supports closedBy natively
    if ("closedBy" in HTMLDialogElement.prototype) return;

    const rect = dialog.getBoundingClientRect();
    const isInside =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInside) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleClick}
      closedby="any"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className={cn(
        "fixed inset-0 m-auto z-50",
        "w-[calc(100%-2rem)] max-w-md",
        "rounded-2xl border border-border bg-background p-5 sm:p-6 shadow-2xl text-foreground",
        "focus:outline-hidden",
        className,
      )}
      style={{ backgroundColor: "var(--background)" }}
    >
      {open ? children : null}
    </dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  isPending?: boolean;
  icon?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isPending = false,
  icon,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the safe "Cancel" button on open to prevent accidental keyboard activation
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const isDanger = variant === "danger";

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isPending) onClose();
      }}
      ariaLabelledBy={titleId}
      ariaDescribedBy={description ? descId : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          {icon ? (
            <div className="shrink-0">{icon}</div>
          ) : isDanger ? (
            <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
          ) : (
            <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
          )}

          <div className="space-y-1 pt-0.5">
            <h3 id={titleId} className="text-base sm:text-lg font-semibold text-foreground leading-snug">
              {title}
            </h3>
            {description && (
              <p id={descId} className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Responsive Button Placement:
            - Mobile: Vertically stacked (flex-col-reverse), Destructive on top, Cancel on bottom in the thumb zone. Full width with 44px+ touch targets.
            - Desktop: Horizontally aligned (sm:flex-row sm:justify-end), Cancel on left, Destructive on right.
            - DOM order: Cancel is first, ensuring keyboard tab navigation hits Cancel first for safety.
        */}
        <div className="mt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={cn(
              "inline-flex h-11 sm:h-9 w-full sm:w-auto items-center justify-center rounded-xl border border-border bg-background px-4 text-xs sm:text-sm font-medium text-foreground transition cursor-pointer",
              "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "inline-flex h-11 sm:h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-medium transition cursor-pointer shadow-xs",
              isDanger
                ? "bg-red-600 hover:bg-red-700 text-white focus-visible:outline-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                : "bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:outline-primary",
              "focus-visible:outline-2 focus-visible:outline-offset-2",
              "disabled:opacity-60 disabled:pointer-events-none",
            )}
          >
            {isPending && <Spinner className="size-3.5" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
