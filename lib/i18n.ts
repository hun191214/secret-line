// lib/i18n.ts
export const locales = ["ko", "en"] as const;
// 나중에 추가할 때 이렇게만 늘리세요:
// export const locales = ["ko", "en", "ja", "zh"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ko";
