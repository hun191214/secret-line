import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 USDT 출금 신청 목록 조회 API
 * GET /api/admin/payouts?status=PENDING
 * 
 * ⚠️ Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // SUPER, FINANCE 허용
    const guard = await requireAdmin(['SUPER', 'FINANCE']);
    if (!guard.authorized) {
      return NextResponse.json(
        { success: false, message: guard.message },
        { status: guard.status }
      );
    }

    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // 필터 조건 구성
    const whereClause: any = {};
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    // 출금 신청 목록 조회
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            counselorProfile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // PENDING 먼저
        { usdtAmount: 'desc' }, // 고액 먼저
        { requestedAt: 'desc' },
      ],
      take: 100,
    });

    // 통계
    const stats = {
      pendingCount: withdrawals.filter((w) => w.status === 'PENDING').length,
      pendingUsdtAmount: withdrawals
        .filter((w) => w.status === 'PENDING')
        .reduce((sum, w) => sum + w.usdtAmount, 0),
      autoCompletedCount: withdrawals.filter((w) => w.status === 'AUTO_COMPLETED').length,
      manualCompletedCount: withdrawals.filter((w) => w.status === 'MANUAL_COMPLETED').length,
      rejectedCount: withdrawals.filter((w) => w.status === 'REJECTED').length,
      totalUsdtProcessed: withdrawals
        .filter((w) => w.status === 'AUTO_COMPLETED' || w.status === 'MANUAL_COMPLETED')
        .reduce((sum, w) => sum + w.usdtAmount, 0),
    };

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        userId: w.userId,
        userEmail: w.user.email,
        userName: w.user.name,
        displayName: w.user.counselorProfile?.displayName,
        milliGoldAmount: w.milliGoldAmount,
        usdtAmount: w.usdtAmount,
        walletAddress: w.walletAddress,
        network: w.network,
        status: w.status,
        rejectedReason: w.rejectedReason,
        txHash: w.txHash,
        requestedAt: w.requestedAt,
        processedAt: w.processedAt,
      })),
      stats,
    });
  } catch (error: any) {
    console.error('❌ [관리자 USDT 출금 목록] 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '출금 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
