/**
 * 비즈니스 로직 상수
 * 수익 배분 및 과금 정책 정의
 */

// 통화료: 분당 $0.14
export const COST_PER_MINUTE = 0.14;

// 수익 배분 비율 (추천인 있는 경우)
export const REVENUE_SPLIT_WITH_REFERRER = {
  COUNSELOR: 0.6,  // 상담사: 60%
  REFERRER: 0.1,   // 남성 회원 추천인: 10%
  COMPANY: 0.3,    // 회사: 30%
} as const;

// 수익 배분 비율 (추천인 없는 경우)
export const REVENUE_SPLIT_WITHOUT_REFERRER = {
  COUNSELOR: 0.6,  // 상담사: 60%
  COMPANY: 0.4,    // 회사: 40%
} as const;

// 법적 안전 용어
export const TERMINOLOGY = {
  CONSULTATION: '상담',
  CONNECTION: '연결',
  CONTENT: '콘텐츠',
  CALL_CHARGE: '통화료',
} as const;

