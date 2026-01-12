import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * USDT 출금 내역 조회 API
 * GET /api/payout/history
 * 
 * ⚠️ Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

export async function GET() {
  // 세션 확인
  let cookieStore;
  let sessionCookie;
  let session;

  try {
    cookieStore = await cookies();
    sessionCookie = cookieStore.get('auth_session');
  } catch {
    return NextResponse.json(
      { success: false, message: '세션 정보를 확인할 수 없습니다.' },
      { status: 401 }
    );
  }

  if (!sessionCookie) {
    return NextResponse.json(
      { success: false, message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const cookieValue = sessionCookie.value.trim();
    session = JSON.parse(cookieValue);
    if (!session || typeof session !== 'object') {
      throw new Error('Invalid session structure');
    }
  } catch (parseError: any) {
    cookieStore.delete('auth_session');
    return NextResponse.json(
      { success: false, message: '세션이 만료되었습니다. 다시 로그인해주세요.', error: 'INVALID_SESSION_COOKIE' },
      { status: 401 }
    );
  }

  if (!session.userId) {
    return NextResponse.json(
      { success: false, message: '유효하지 않은 세션입니다.' },
      { status: 401 }
    );
  }

  try {
    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 출금 내역 조회
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { userId: session.userId },
      orderBy: { requestedAt: 'desc' },
      take: 50, // 최근 50건
    });

    // 통계 계산
    const stats = {
      totalRequests: withdrawals.length,
      totalUsdtAmount: withdrawals
        .filter((w) => w.status !== 'REJECTED')
        .reduce((sum, w) => sum + w.usdtAmount, 0),
      totalMilliGold: withdrawals
        .filter((w) => w.status !== 'REJECTED')
        .reduce((sum, w) => sum + w.milliGold, 0),
      pendingCount: withdrawals.filter((w) => w.status === 'PENDING').length,
      completedCount: withdrawals.filter(
        (w) => w.status === 'AUTO_COMPLETED' || w.status === 'MANUAL_COMPLETED'
      ).length,
    };

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        milliGold: w.milliGold,
        usdtAmount: w.usdtAmount,
        walletAddress: w.walletAddress.slice(0, 8) + '...' + w.walletAddress.slice(-6), // 마스킹
        walletAddressFull: w.walletAddress, // 전체 주소 (본인 확인용)
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
    console.error('❌ [USDT 출금 내역] 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '출금 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
