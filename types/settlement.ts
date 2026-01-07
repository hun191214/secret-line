/**
 * 정산 관련 TypeScript 타입 정의
 */

export type SettlementType = 'COUNSELOR' | 'REFERRER' | 'COMPANY';
export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Settlement {
  id: string;
  userId: string;
  callId?: string;
  amount: number;
  type: SettlementType;
  percentage: number;
  status: SettlementStatus;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementCalculation {
  totalCost: number;
  counselor: number;
  referrer?: number;
  company: number;
  hasReferrer: boolean;
}

