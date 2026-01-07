/**
 * 정산 계산 로직
 * 수익 배분 및 정산 금액 계산
 */

import {
  COST_PER_MINUTE,
  REVENUE_SPLIT_WITH_REFERRER,
  REVENUE_SPLIT_WITHOUT_REFERRER,
} from './constants';

/**
 * 통화 시간(분)을 기반으로 통화 비용 계산
 * @param durationMinutes 통화 시간 (분)
 * @returns 통화 비용 (USD)
 */
export function calculateCallCost(durationMinutes: number): number {
  return durationMinutes * COST_PER_MINUTE;
}

/**
 * 추천인이 있는 경우 수익 배분 계산
 * @param totalCost 총 통화 비용
 * @returns 배분된 수익 객체
 */
export function calculateRevenueSplitWithReferrer(totalCost: number) {
  return {
    counselor: totalCost * REVENUE_SPLIT_WITH_REFERRER.COUNSELOR,
    referrer: totalCost * REVENUE_SPLIT_WITH_REFERRER.REFERRER,
    company: totalCost * REVENUE_SPLIT_WITH_REFERRER.COMPANY,
  };
}

/**
 * 추천인이 없는 경우 수익 배분 계산
 * @param totalCost 총 통화 비용
 * @returns 배분된 수익 객체
 */
export function calculateRevenueSplitWithoutReferrer(totalCost: number) {
  return {
    counselor: totalCost * REVENUE_SPLIT_WITHOUT_REFERRER.COUNSELOR,
    company: totalCost * REVENUE_SPLIT_WITHOUT_REFERRER.COMPANY,
  };
}

/**
 * 통화 종료 후 정산 계산
 * @param durationMinutes 통화 시간 (분)
 * @param hasReferrer 추천인 존재 여부
 * @returns 정산 정보 객체
 */
export function calculateSettlement(durationMinutes: number, hasReferrer: boolean) {
  const totalCost = calculateCallCost(durationMinutes);

  if (hasReferrer) {
    const split = calculateRevenueSplitWithReferrer(totalCost);
    return {
      totalCost,
      ...split,
      referrerAmount: split.referrer,
      hasReferrer: true,
    };
  } else {
    const split = calculateRevenueSplitWithoutReferrer(totalCost);
    return {
      totalCost,
      ...split,
      referrerAmount: 0,
      hasReferrer: false,
    };
  }
}

