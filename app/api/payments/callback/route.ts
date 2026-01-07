/**
 * NOWPayments 웹훅 콜백 API
 * POST /api/payments/callback - IPN (Instant Payment Notification) 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyIPNSignature } from '@/lib/nowpayments';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-nowpayments-sig') || '';
    const payload = await request.json();

    // IPN 서명 검증
    if (!verifyIPNSignature(payload, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 결제 상태 업데이트
    const payment = await prisma.payment.update({
      where: { paymentId: payload.payment_id },
      data: {
        status: mapPaymentStatus(payload.payment_status),
        metadata: payload,
      },
    });

    return NextResponse.json({ success: true, payment }, { status: 200 });
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process callback' },
      { status: 500 }
    );
  }
}

function mapPaymentStatus(status: string): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  switch (status.toLowerCase()) {
    case 'waiting':
      return 'PENDING';
    case 'confirming':
    case 'exchanging':
      return 'PROCESSING';
    case 'finished':
      return 'COMPLETED';
    case 'failed':
    case 'refunded':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

