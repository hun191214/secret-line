/**
 * 추천인 API 라우트
 * POST /api/referrals - 추천인 등록
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referrerId, referredId, referralCode } = body;

    if (!referrerId || !referredId || !referralCode) {
      return NextResponse.json(
        { error: 'referrerId, referredId, and referralCode are required' },
        { status: 400 }
      );
    }

    // 추천인 코드 중복 확인
    const existing = await prisma.referral.findUnique({
      where: { referralCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Referral code already exists' },
        { status: 409 }
      );
    }

    const referral = await prisma.referral.create({
      data: {
        referrerId,
        referredId,
        referralCode,
        status: 'ACTIVE',
      },
      include: {
        referrer: true,
        referred: true,
      },
    });

    return NextResponse.json({ referral }, { status: 201 });
  } catch (error: any) {
    console.error('Create referral error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create referral' },
      { status: 500 }
    );
  }
}

