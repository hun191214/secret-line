export const locales = ['ko', 'en', 'ja', 'zh'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ko';

// Header.tsx에서 사용하는 데이터 추가
export const localeNames: Record<Locale, string> = {
	ko: '한국어',
	en: 'English',
	ja: '日本語',
	zh: '中文'
};

export const localeFlags: Record<Locale, string> = {
	ko: '🇰🇷',
	en: '🇺🇸',
	ja: '🇯🇵',
	zh: '🇨🇳'
};

// Turbopack 빌드 에러 해결을 위한 default export 추가
export default { locales, defaultLocale, localeNames, localeFlags };
