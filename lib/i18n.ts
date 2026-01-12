export const locales = ["en", "ko", "ja", "zh"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export default {
  locales,
  defaultLocale,
};
