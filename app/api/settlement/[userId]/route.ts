/**
 * 사용자별 정산 조회 API
 * GET /api/settlement/[userId] - 특정 사용자의 정산 내역 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const settlements = await prisma.settlement.findMany({
      where: { userId },
      include: {
        call: {
          include: {
            caller: true,
            counselor: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);

    return NextResponse.json({
      userId,
      settlements,
      totalAmount,
      count: settlements.length,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Get user settlements error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get settlements' },
      { status: 500 }
    );
  }
}

