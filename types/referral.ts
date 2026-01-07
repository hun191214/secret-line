/**
 * 추천인 관련 TypeScript 타입 정의
 */

export type ReferralStatus = 'ACTIVE' | 'INACTIVE';

export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  referralCode: string;
  status: ReferralStatus;
  totalEarnings: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReferralRequest {
  referrerId: string;
  referredId: string;
  referralCode: string;
}

export interface ReferralEarnings {
  referralId: string;
  referralCode: string;
  totalEarnings: number;
  totalCalls: number;
  lastUpdated: Date;
}

