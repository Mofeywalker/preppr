import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/uploads")) {
    return NextResponse.next();
  }

  const isAuthPage =
    pathname.endsWith("/login") ||
    pathname.endsWith("/register") ||
    pathname === "/login" ||
    pathname === "/register";

  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ||
    req.cookies.get("__Secure-better-auth.session_token")?.value;

  const localeMatch = pathname.match(/^\/(de|en)($|\/)/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  if (!sessionToken && !isAuthPage) {
    const loginUrl = new URL(`/${locale}/login`, req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (sessionToken && isAuthPage) {
    const homeUrl = new URL(`/${locale}`, req.url);
    return NextResponse.redirect(homeUrl);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

