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

  return <LoginClient hasOidc={hasOidc} />;
}
