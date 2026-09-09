import { setRequestLocale } from "next-intl/server";
import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const registrationDisabled = process.env.AUTH_DISABLE_REGISTER === "true";

  return <RegisterClient registrationDisabled={registrationDisabled} />;
}
