/**
 * 통화 API 라우트
 * POST /api/calls - 통화 시작
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateChannelName } from '@/lib/agora';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callerId, counselorId, referralCode } = body;

    if (!callerId || !counselorId) {
      return NextResponse.json(
        { error: 'callerId and counselorId are required' },
        { status: 400 }
      );
    }

    // 추천인 확인
    let referralId: string | undefined;
    if (referralCode) {
      const referral = await prisma.referral.findUnique({
        where: { referralCode, status: 'ACTIVE' },
      });
      referralId = referral?.id;
    }

    // 통화 생성
    const channelName = generateChannelName();
    const call = await prisma.call.create({
      data: {
        callerId,
        counselorId,
        referralId,
        status: 'INITIATED',
        agoraChannel: channelName,
      },
      include: {
        caller: true,
        counselor: true,
        referral: true,
      },
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error: any) {
    console.error('Call creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create call' },
      { status: 500 }
    );
  }
}

