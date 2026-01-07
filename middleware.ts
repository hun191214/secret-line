import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './lib/i18n';

// next-intl 미들웨어 생성
const intlMiddleware = createMiddleware({
  // 지원 언어 목록
  locales,
  // 기본 언어
  defaultLocale,
  // URL에 기본 언어 prefix 포함 여부 (false면 /ko 대신 / 사용)
  localePrefix: 'always',
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API 라우트는 다국어 처리하지 않음
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 루트 경로(/)로 접근 시 브라우저 언어에 따라 리다이렉트
  if (pathname === '/') {
    const acceptLanguage = request.headers.get('accept-language') || '';
    const preferredLocale = getPreferredLocale(acceptLanguage);
    
    return NextResponse.redirect(new URL(`/${preferredLocale}`, request.url));
  }

  // next-intl 미들웨어 실행
  return intlMiddleware(request);
}

// Accept-Language 헤더에서 선호 언어 추출
function getPreferredLocale(acceptLanguage: string): string {
  // Accept-Language 파싱 (예: "ko-KR,ko;q=0.9,en-US;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(), // "ko-KR" -> "ko"
        quality: qValue ? parseFloat(qValue) : 1,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // 지원하는 언어 중 가장 선호하는 언어 반환
  for (const lang of languages) {
    if (locales.includes(lang.code as any)) {
      return lang.code;
    }
  }

  // 매칭되는 언어가 없으면 기본 언어 반환
  return defaultLocale;
}

export const config = {
  // 다국어 처리할 경로 패턴
  matcher: [
    // 모든 경로 매칭 (API, _next, 파일 제외)
    '/((?!api|_next|.*\\..*).*)',
  ],
};

