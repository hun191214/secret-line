/**
 * 통화 종료 API
 * POST /api/calls/[callId]/end - 통화 종료 및 정산 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateSettlement } from '@/lib/settlement';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        referral: true,
      },
    });

    if (!call || !call.startedAt) {
      return NextResponse.json(
        { error: 'Call not found or not started' },
        { status: 404 }
      );
    }

    // 통화 시간 계산 (분 단위)
    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000);
    const durationMinutes = durationSeconds / 60;

    // 정산 계산
    const hasReferrer = !!call.referralId;
    const settlement = calculateSettlement(durationMinutes, hasReferrer);

    // 통화 업데이트
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'ENDED',
        endedAt,
        duration: durationSeconds,
        cost: settlement.totalCost,
      },
    });

    // 정산 레코드 생성 (트랜잭션 처리 필요)
    await createSettlements(callId, call, settlement);

    return NextResponse.json({
      call: updatedCall,
      settlement,
    }, { status: 200 });
  } catch (error: any) {
    console.error('End call error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to end call' },
      { status: 500 }
    );
  }
}

async function createSettlements(
  callId: string,
  call: any,
  settlement: ReturnType<typeof calculateSettlement>
) {
  const settlements = [];

  // 상담사 정산 (60%)
  settlements.push(
    prisma.settlement.create({
      data: {
        userId: call.counselorId,
        callId,
        amount: settlement.counselor,
        type: 'COUNSELOR',
        percentage: 0.6,
      },
    })
  );

  // 추천인 정산 (10%)
  if (settlement.hasReferrer && call.referralId) {
    settlements.push(
      prisma.settlement.create({
        data: {
          userId: call.referral.referrerId,
          callId,
          amount: settlement.referrerAmount,
          type: 'REFERRER',
          percentage: 0.1,
        },
      })
    );
  }

  // 회사 정산 (30% 또는 40%)
  const companyPercentage = settlement.hasReferrer ? 0.3 : 0.4;
  // TODO: 회사 계정 ID를 설정해야 함
  const companyUserId = 'company-account-id'; // 실제 회사 계정 ID로 변경 필요

  settlements.push(
    prisma.settlement.create({
      data: {
        userId: companyUserId,
        callId,
        amount: settlement.company,
        type: 'COMPANY',
        percentage: companyPercentage,
      },
    })
  );

  await Promise.all(settlements);
}

