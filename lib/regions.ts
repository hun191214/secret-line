/**
 * 글로벌 지역 코드 및 유틸리티
 * Phase 2: 지역 우선순위 릴레이 매칭 시스템
 */

// 지역 코드 타입
export type RegionCode = 
  | 'SEA'        // 동남아시아 (Southeast Asia)
  | 'EAST_ASIA'  // 동아시아 (Korea, Japan, China, Taiwan)
  | 'SOUTH_ASIA' // 남아시아 (India, Pakistan, Bangladesh)
  | 'CENTRAL_ASIA' // 중앙아시아
  | 'EUROPE'     // 유럽
  | 'AMERICAS'   // 아메리카
  | 'AFRICA'     // 아프리카
  | 'OCEANIA';   // 오세아니아

// 지역 정보
export const REGIONS: Record<RegionCode, {
  name: string;
  nameKo: string;
  nameEn: string;
  emoji: string;
  countries: string[];
}> = {
  SEA: {
    name: '동남아시아',
    nameKo: '동남아시아',
    nameEn: 'Southeast Asia',
    emoji: '🌴',
    countries: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG', 'MM', 'KH', 'LA', 'BN'],
  },
  EAST_ASIA: {
    name: '동아시아',
    nameKo: '동아시아',
    nameEn: 'East Asia',
    emoji: '🏯',
    countries: ['KR', 'JP', 'CN', 'TW', 'HK', 'MO'],
  },
  SOUTH_ASIA: {
    name: '남아시아',
    nameKo: '남아시아',
    nameEn: 'South Asia',
    emoji: '🕌',
    countries: ['IN', 'PK', 'BD', 'LK', 'NP', 'BT', 'MV'],
  },
  CENTRAL_ASIA: {
    name: '중앙아시아',
    nameKo: '중앙아시아',
    nameEn: 'Central Asia',
    emoji: '🏔️',
    countries: ['KZ', 'UZ', 'TM', 'KG', 'TJ', 'AF', 'MN'],
  },
  EUROPE: {
    name: '유럽',
    nameKo: '유럽',
    nameEn: 'Europe',
    emoji: '🏰',
    countries: ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'UA', 'RU', 'TR'],
  },
  AMERICAS: {
    name: '아메리카',
    nameKo: '아메리카',
    nameEn: 'Americas',
    emoji: '🗽',
    countries: ['US', 'CA', 'MX', 'BR', 'AR', 'CO', 'PE', 'CL'],
  },
  AFRICA: {
    name: '아프리카',
    nameKo: '아프리카',
    nameEn: 'Africa',
    emoji: '🦁',
    countries: ['ZA', 'NG', 'EG', 'KE', 'MA', 'GH', 'TZ', 'ET'],
  },
  OCEANIA: {
    name: '오세아니아',
    nameKo: '오세아니아',
    nameEn: 'Oceania',
    emoji: '🦘',
    countries: ['AU', 'NZ', 'FJ', 'PG'],
  },
};

// 국가코드 → 지역코드 변환
export function getRegionByCountry(countryCode: string): RegionCode | null {
  const upperCode = countryCode.toUpperCase();
  
  for (const [region, data] of Object.entries(REGIONS)) {
    if (data.countries.includes(upperCode)) {
      return region as RegionCode;
    }
  }
  
  return null;
}

// 지역 목록 (UI용)
export function getRegionOptions(locale: string = 'ko'): Array<{
  value: RegionCode;
  label: string;
  emoji: string;
}> {
  return Object.entries(REGIONS).map(([code, data]) => ({
    value: code as RegionCode,
    label: locale === 'ko' ? data.nameKo : data.nameEn,
    emoji: data.emoji,
  }));
}

// 언어 코드 타입
export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'vi' | 'tl' | 'th' | 'id';

// 언어 정보
export const LANGUAGES: Record<LanguageCode, {
  name: string;
  nativeName: string;
  emoji: string;
}> = {
  ko: { name: 'Korean', nativeName: '한국어', emoji: '🇰🇷' },
  en: { name: 'English', nativeName: 'English', emoji: '🇺🇸' },
  ja: { name: 'Japanese', nativeName: '日本語', emoji: '🇯🇵' },
  zh: { name: 'Chinese', nativeName: '中文', emoji: '🇨🇳' },
  es: { name: 'Spanish', nativeName: 'Español', emoji: '🇪🇸' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', emoji: '🇻🇳' },
  tl: { name: 'Filipino', nativeName: 'Tagalog', emoji: '🇵🇭' },
  th: { name: 'Thai', nativeName: 'ไทย', emoji: '🇹🇭' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', emoji: '🇮🇩' },
};

// 언어 JSON 문자열 파싱
export function parseLanguages(languagesJson: string | null): LanguageCode[] {
  if (!languagesJson) return [];
  
  try {
    const parsed = JSON.parse(languagesJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((lang): lang is LanguageCode => 
        Object.keys(LANGUAGES).includes(lang)
      );
    }
  } catch {
    // 파싱 실패 시 빈 배열 반환
  }
  
  return [];
}

// 언어 배열 → JSON 문자열
export function stringifyLanguages(languages: LanguageCode[]): string {
  return JSON.stringify(languages);
}

