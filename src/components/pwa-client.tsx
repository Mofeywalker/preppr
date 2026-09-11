"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useOffline } from "next/offline";
import { useRouter } from "@/i18n/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function PwaClient() {
  const t = useTranslations("Pwa");
  const router = useRouter();
  const nextIsOffline = useOffline();
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
  const browserOffline = !isOnline;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  // Refresh server data when restored from bfcache or navigating back/forward
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        router.refresh();
      }
    };
    const handlePopState = () => {
      router.refresh();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  // Register service worker & handle install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    // In development or on localhost, unregister service workers to avoid stale bundles and hydration errors
    if (process.env.NODE_ENV === "development" || window.location.hostname === "localhost") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key);
            }
          });
        }
      }
      return;
    }

    // Service Worker Registration
    if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => {
          console.warn("PWA: ServiceWorker registration failed:", error);
        });
    }

    // Check if already running in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    // Check dismiss preference
    const isDismissed = localStorage.getItem("preppr_pwa_install_dismissed");

    if (!isStandalone && !isDismissed) {
      // iOS detection
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice =
        /iphone|ipad|ipod/.test(userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      if (isIosDevice) {
        // Delay showing prompt to avoid interfering with initial page view
        const timer = setTimeout(() => {
          setIsIos(true);
          setShowInstallPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }

      // Android / Chromium beforeinstallprompt handler
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowInstallPrompt(true);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    try {
      localStorage.setItem("preppr_pwa_install_dismissed", "true");
    } catch {
      // ignore
    }
  };

  const isOffline = nextIsOffline || browserOffline;

  return (
    <>
      {/* Offline Status Banner */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-md transition-transform"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 shrink-0"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>{t("offlineDesc")}</span>
        </div>
      )}

      {/* PWA Install Promotion Card / Banner */}
      {showInstallPrompt && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-40 rounded-xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
          role="dialog"
          aria-label={t("installTitle")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-900 text-white shrink-0 border border-border">
                <svg width="22" height="22" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="9" height="44" rx="4.5" fill="#fafafa" />
                  <path
                    d="M22 10H42C48.0751 10 53 14.9249 53 19.5C53 20.3284 52.3284 21 51.5 21H22V10Z"
                    fill="#fafafa"
                  />
                  <path
                    d="M22 23.5H51.5C52.3284 23.5 53 24.1716 53 25C53 29.5751 48.0751 34.5 42 34.5H22V23.5Z"
                    fill="#fafafa"
                  />
                  <circle cx="42.5" cy="22.25" r="3" fill="#10B981" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{t("installTitle")}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{t("installDesc")}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition"
              aria-label={t("dismiss")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={handleDismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition"
            >
              {t("dismiss")}
            </button>

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition"
              >
                {t("installButton")}
              </button>
            )}

            {isIos && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium text-right">
                {t("iosSharePrompt")}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
