import { getRequestConfig } from 'next-intl/server';
import { routing } from '../lib/routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  // 디버깅 로그 추가
  console.log(`[i18n] 현재 시도 중인 로케일: ${locale}`);

  if (!locale || !routing.locales.includes(locale as any)) {
    console.warn(`[i18n] 유효하지 않은 로케일이 감지되어 기본값(${routing.defaultLocale})으로 대체합니다.`);
    return {
      locale: routing.defaultLocale,
      messages: (await import(`../messages/${routing.defaultLocale}.json`)).default
    };
  }

  try {
    const messages = (await import(`../messages/${locale}.json`)).default;
    console.log(`[i18n] ${locale}.json 메시지 로드 성공`);
    return { locale, messages };
  } catch (error) {
    console.error(`[i18n] ${locale}.json 로드 실패:`, error);
    // 실패 시 빈 메시지라도 반환하여 빌드 중단 방지
    return { locale, messages: {} };
  }
});
