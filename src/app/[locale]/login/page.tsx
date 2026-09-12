import { setRequestLocale } from "next-intl/server";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const hasOidc = !!process.env.OIDC_CLIENT_ID;
  const emailAuthDisabled =
    hasOidc &&
    (process.env.AUTH_DISABLE_EMAIL_LOGIN === "true" ||
      process.env.AUTH_DISABLE_EMAIL_PASSWORD === "true");
  const registrationDisabled =
    emailAuthDisabled || process.env.AUTH_DISABLE_REGISTER === "true";

  return (
    <LoginClient
      hasOidc={hasOidc}
      emailAuthDisabled={emailAuthDisabled}
      registrationDisabled={registrationDisabled}
    />
  );
}
