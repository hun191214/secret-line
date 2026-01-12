/**
 * 결제 API 라우트
 * POST /api/payments - 결제 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPayment } from '@/lib/nowpayments';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency = 'USD', userId } = body;

    if (!amount || !userId) {
      return NextResponse.json(
        { error: 'Amount and userId are required' },
        { status: 400 }
      );
    }

    // 결제 생성
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const paymentData = await createPayment(amount, currency, orderId);

    // 데이터베이스에 결제 정보 저장
    const payment = await prisma.payment.create({
      data: {
        userId,
        milliAmount: amount,
        currency,
        paymentId: paymentData.payment_id,
        status: 'PENDING',
        metadata: paymentData,
      },
    });

    return NextResponse.json({ payment, paymentData }, { status: 201 });
  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}

