/**
 * 정산 계산 API
 * POST /api/settlement/calculate - 정산 금액 사전 계산
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateSettlement } from '@/lib/settlement';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { durationMinutes, hasReferrer } = body;

    if (!durationMinutes || durationMinutes <= 0) {
      return NextResponse.json(
        { error: 'durationMinutes must be a positive number' },
        { status: 400 }
      );
    }

    const settlement = calculateSettlement(
      durationMinutes,
      hasReferrer || false
    );

    return NextResponse.json({ settlement }, { status: 200 });
  } catch (error: any) {
    console.error('Calculate settlement error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate settlement' },
      { status: 500 }
    );
  }
}

