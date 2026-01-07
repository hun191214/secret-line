import { getRequestConfig } from 'next-intl/server';

// 지원 언어 목록
export const locales = ['ko', 'en', 'ja', 'zh', 'es'] as const;
export type Locale = (typeof locales)[number];

// 기본 언어
export const defaultLocale: Locale = 'ko';

// 언어별 표시 이름
export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
};

// 언어별 국가 플래그 이모지
export const localeFlags: Record<Locale, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
  es: '🇪🇸',
};

// 언어가 유효한지 확인
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

// next-intl v4+ 설정 (requestLocale 사용)
export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale은 미들웨어에서 설정됨
  const locale = await requestLocale;
  
  // locale이 없거나 유효하지 않으면 기본값 사용
  const validLocale = locale && isValidLocale(locale) ? locale : defaultLocale;

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  };
});

