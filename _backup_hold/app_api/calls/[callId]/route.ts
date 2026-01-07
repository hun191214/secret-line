/**
 * 통화 상태 관리 API
 * GET /api/calls/[callId] - 통화 정보 조회
 * PUT /api/calls/[callId] - 통화 상태 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const call = await prisma.call.findUnique({
      where: { id: params.callId },
      include: {
        caller: true,
        counselor: true,
        referral: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ call }, { status: 200 });
  } catch (error: any) {
    console.error('Get call error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get call' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    const call = await prisma.call.update({
      where: { id: params.callId },
      data: {
        status,
        ...(status === 'ACTIVE' && !body.startedAt ? { startedAt: new Date() } : {}),
      },
      include: {
        caller: true,
        counselor: true,
      },
    });

    return NextResponse.json({ call }, { status: 200 });
  } catch (error: any) {
    console.error('Update call error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update call' },
      { status: 500 }
    );
  }
}

