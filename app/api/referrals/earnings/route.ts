/**
 * 추천인 수익 조회 API
 * GET /api/referrals/earnings?referrerId=xxx - 추천인별 수익 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const referrerId = searchParams.get('referrerId');

    if (!referrerId) {
      return NextResponse.json(
        { error: 'referrerId is required' },
        { status: 400 }
      );
    }

    // 추천인 정보 조회
    const referrals = await prisma.referral.findMany({
      where: { referrerId, status: 'ACTIVE' },
      include: {
        referred: true,
        calls: {
          include: {
            settlements: {
              where: { type: 'REFERRER' },
            },
          },
        },
      },
    });

    // 수익 계산
    const earnings = referrals.map((referral) => {
      const totalEarnings = referral.calls.reduce((sum, call) => {
        const settlement = call.settlements.find((s) => s.type === 'REFERRER');
        return sum + (settlement?.amount || 0);
      }, 0);

      return {
        referralId: referral.id,
        referralCode: referral.referralCode,
        referredUserId: referral.referredId,
        totalEarnings,
        totalCalls: referral.calls.length,
        lastUpdated: referral.updatedAt,
      };
    });

    const totalEarnings = earnings.reduce((sum, e) => sum + e.totalEarnings, 0);

    return NextResponse.json({
      referrerId,
      earnings,
      totalEarnings,
      totalReferrals: earnings.length,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Get referral earnings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get earnings' },
      { status: 500 }
    );
  }
}

