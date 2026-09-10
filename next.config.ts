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
  experimental: {
    useOffline: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
