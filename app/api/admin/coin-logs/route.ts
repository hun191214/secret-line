import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 코인 지급 내역 조회 API
 * GET: 코인 지급 로그 목록 조회
 * 
 * 권한: SUPER, OPERATOR (읽기 전용)
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // SUPER, OPERATOR 허용
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
    if (!guard.authorized) {
      return NextResponse.json(
        { success: false, message: guard.message },
        { status: guard.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';

    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 검색 조건 생성
    const whereClause: any = {};
    if (search.trim()) {
      whereClause.OR = [
        { grantedByEmail: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // 전체 개수 조회
    const totalCount = await prisma.coinGrantLog.count({
      where: whereClause,
    });

    // 로그 목록 조회
    const logs = await prisma.coinGrantLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 통계 (SUPER만)
    let stats = null;
    if (guard.user.adminRole === 'SUPER') {
      const totalGranted = await prisma.coinGrantLog.aggregate({
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      // 오늘 지급량
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayGranted = await prisma.coinGrantLog.aggregate({
        where: {
          createdAt: {
            gte: today,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      stats = {
        totalAmount: totalGranted._sum.amount || 0,
        totalCount: totalGranted._count.id || 0,
        todayAmount: todayGranted._sum.amount || 0,
        todayCount: todayGranted._count.id || 0,
      };
    }

    // 응답 데이터 포맷팅
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      grantedAt: log.createdAt,
      grantedBy: log.grantedByEmail,
      recipientEmail: log.user.email,
      recipientName: log.user.nickname || log.user.name || '익명',
      amount: log.amount,
      reason: log.reason,
      previousBalance: log.previousBalance,
      newBalance: log.newBalance,
    }));

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats,
    });
  } catch (error: any) {
    console.error('코인 지급 내역 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '코인 지급 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

