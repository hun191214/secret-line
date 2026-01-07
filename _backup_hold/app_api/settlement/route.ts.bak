/**
 * 정산 API 라우트
 * GET /api/settlement - 정산 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const settlements = await prisma.settlement.findMany({
      where,
      include: {
        user: true,
        call: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ settlements }, { status: 200 });
  } catch (error: any) {
    console.error('Get settlements error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get settlements' },
      { status: 500 }
    );
  }
}

