/**
 * 결제 관련 TypeScript 타입 정의
 */

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  paymentId: string;
  status: PaymentStatus;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentRequest {
  amount: number;
  currency?: string;
  userId: string;
}

export interface PaymentCallback {
  payment_id: string;
  invoice_id?: string;
  payment_status: string;
  pay_address?: string;
  price_amount?: number;
  price_currency?: string;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  pay_amount?: number;
  actually_paid?: number;
  outcome_amount?: number;
  outcome_currency?: string;
}

