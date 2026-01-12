import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/lib/i18n";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "always",
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // / 는 글로벌 랜딩 유지
  if (pathname === "/") return NextResponse.next();

  // 내부/정적 경로 제외
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
