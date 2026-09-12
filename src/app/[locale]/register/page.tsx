import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
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

  if (emailAuthDisabled) {
    redirect({ href: "/login", locale });
  }

  const registrationDisabled = process.env.AUTH_DISABLE_REGISTER === "true";

  return (
    <RegisterClient
      registrationDisabled={registrationDisabled}
      hasOidc={hasOidc}
    />
  );
}
