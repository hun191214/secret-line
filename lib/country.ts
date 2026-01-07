/**
 * 국가 코드별 국기 이모지 및 이름 매핑
 */

export const COUNTRY_INFO: Record<string, { flag: string; name: string }> = {
  KR: { flag: '🇰🇷', name: '대한민국' },
  JP: { flag: '🇯🇵', name: '일본' },
  US: { flag: '🇺🇸', name: '미국' },
  CN: { flag: '🇨🇳', name: '중국' },
  VN: { flag: '🇻🇳', name: '베트남' },
  PH: { flag: '🇵🇭', name: '필리핀' },
  TH: { flag: '🇹🇭', name: '태국' },
  OTHER: { flag: '🌍', name: '기타' },
};

export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode) return '🌍';
  return COUNTRY_INFO[countryCode]?.flag || '🌍';
}

export function getCountryName(countryCode: string | null | undefined): string {
  if (!countryCode) return '기타';
  return COUNTRY_INFO[countryCode]?.name || '기타';
}

