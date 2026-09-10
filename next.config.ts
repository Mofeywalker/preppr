import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "youtube-transcript"],
  env: {
    NEXT_PUBLIC_APP_LOCALE:
      process.env.APP_LOCALE ||
      process.env.NEXT_PUBLIC_APP_LOCALE ||
      process.env.APP_LANGUAGE ||
      process.env.DEFAULT_LOCALE ||
      "de",
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
