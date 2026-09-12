import createMiddleware from "next-intl/middleware";
import { routing, getInstanceLocale } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/.well-known") ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-icon" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const instanceLocale = getInstanceLocale();

  // If a URL is requested with another locale prefix (e.g. /en when instance is de),
  // redirect to the instance locale.
  const localeMatch = pathname.match(/^\/(de|en)($|\/.*)/);
  if (localeMatch) {
    const urlLocale = pathname.split("/")[1];
    if (urlLocale !== instanceLocale) {
      const rest = pathname.substring(urlLocale.length + 1);
      const redirectUrl = new URL(`/${instanceLocale}${rest || ""}`, req.url);
      redirectUrl.search = req.nextUrl.search;
      return NextResponse.redirect(redirectUrl);
    }
  }

  const isAuthPage =
    pathname.endsWith("/login") ||
    pathname.endsWith("/register") ||
    pathname === "/login" ||
    pathname === "/register";

  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ||
    req.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionToken && !isAuthPage) {
    const loginUrl = new URL(`/${instanceLocale}/login`, req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (sessionToken && isAuthPage) {
    const homeUrl = new URL(`/${instanceLocale}`, req.url);
    return NextResponse.redirect(homeUrl);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|apple-icon|.*\\..*).*)"],
};

