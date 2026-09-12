"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export function LoginClient({
  hasOidc,
  emailAuthDisabled = false,
  registrationDisabled = false,
}: {
  hasOidc: boolean;
  emailAuthDisabled?: boolean;
  registrationDisabled?: boolean;
}) {
  const t = useTranslations("Auth");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailAuthDisabled) return;
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(t("invalidCredentials"));
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(t("invalidCredentials"));
      setLoading(false);
    }
  };

  const handleOidcSignIn = async () => {
    setError(null);
    setOidcLoading(true);
    try {
      await authClient.signIn.social({
        provider: "oidc",
        callbackURL: window.location.origin,
      });
    } catch {
      setError(t("invalidCredentials"));
      setOidcLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size="xl" className="justify-center" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            {t("signIn")}
          </h2>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {emailAuthDisabled && hasOidc ? (
          <div className="space-y-4 pt-2">
            <p className="text-center text-sm text-muted-foreground">
              {t("ssoOnlyNotice")}
            </p>
            <Button
              type="button"
              className="w-full py-2.5 font-semibold flex items-center justify-center gap-2 cursor-pointer"
              disabled={oidcLoading}
              onClick={handleOidcSignIn}
            >
              {oidcLoading ? (
                <span>{t("submitting")}</span>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  <span>{t("signInWithOidc")}</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {hasOidc && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full py-2.5 font-medium flex items-center justify-center gap-2"
                  disabled={oidcLoading || loading}
                  onClick={handleOidcSignIn}
                >
                  {oidcLoading ? (
                    <span>{t("submitting")}</span>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                        />
                      </svg>
                      <span>{t("signInWithOidc")}</span>
                    </>
                  )}
                </Button>

                <div className="relative flex items-center justify-center">
                  <div className="w-full border-t border-border" />
                  <span className="bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
                    {t("or")}
                  </span>
                </div>
              </div>
            )}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  {t("email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  {t("password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <Button
                type="submit"
                className="w-full py-2.5 font-semibold"
                disabled={loading || oidcLoading}
              >
                {loading ? t("submitting") : t("signIn")}
              </Button>
            </form>

            {!registrationDisabled && (
              <div className="text-center text-sm">
                <Link
                  href="/register"
                  className="font-medium text-primary hover:underline"
                >
                  {t("noAccount")}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
