/**
 * 추천인 코드 검증 API
 * GET /api/referrals/[code] - 추천인 코드 유효성 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const referral = await prisma.referral.findUnique({
      where: { referralCode: code },
      include: {
        referrer: true,
      },
    });

    if (!referral || referral.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Invalid or inactive referral code' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      referral: {
        id: referral.id,
        referralCode: referral.referralCode,
        referrerId: referral.referrerId,
        referrerName: referral.referrer.name,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('Verify referral code error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify referral code' },
      { status: 500 }
    );
  }
}

