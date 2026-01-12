export const locales = ['ko', 'en', 'ja', 'zh'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ko';
