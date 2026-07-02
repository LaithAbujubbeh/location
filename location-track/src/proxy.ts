import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/i18n";

function getPreferredLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get(localeCookieName)?.value;

  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptedLanguages = request.headers
    .get("accept-language")
    ?.split(",")
    .map((entry) => entry.trim().split(";")[0]?.split("-")[0])
    .filter(Boolean);

  const headerLocale = acceptedLanguages?.find((locale) => isLocale(locale));

  return headerLocale ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathnameHasLocale =
    pathname === "/en" ||
    pathname === "/ar" ||
    pathname.startsWith("/en/") ||
    pathname.startsWith("/ar/");

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  const locale = getPreferredLocale(request);
  const url = request.nextUrl.clone();

  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
