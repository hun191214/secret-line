import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 관리자 대시보드 통계 API
 * - 오늘의 총수익 (금일 결제된 USDT 합계 및 코인 정산 수수료)
 * - 현재 실시간 통화 중인 유저/상담사 수
 * - 미처리 상담사 신청 건수 (Pending)
 * - 금일 신규 가입자 수
 */
export async function GET() {
  try {
    const isConnected = await ensurePrismaConnected();
    
    if (!isConnected) {
      // DB 연결 실패 시 목업 데이터 반환
      return NextResponse.json({
        success: true,
        stats: {
          todayRevenue: {
            payments: 0,
            settlements: 0,
            total: 0,
          },
          activeCalls: {
            count: 0,
            users: 0,
            counselors: 0,
          },
          pendingRequests: 0,
          newUsersToday: 0,
        },
        updatedAt: new Date().toISOString(),
      });
    }

    // 오늘 날짜 범위 계산 (UTC 기준)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 병렬로 통계 쿼리 실행
    const [
      todayPayments,
      todayCompanySettlements,
      activeCalls,
      pendingRequests,
      newUsersToday,
    ] = await Promise.all([
      // 1. 오늘 완료된 결제 금액 합계
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // 2. 오늘 회사 정산 금액 합계 (COMPANY 타입)
      prisma.settlement.aggregate({
        where: {
          type: 'COMPANY',
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // 3. 현재 진행 중인 통화 수
      prisma.call.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          callerId: true,
          counselorId: true,
        },
      }),

      // 4. 미처리 상담사 신청 건수
      prisma.counselorProfile.count({
        where: {
          status: 'PENDING',
        },
      }),

      // 5. 오늘 신규 가입자 수
      prisma.user.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
    ]);

    // 고유한 유저/상담사 수 계산
    const uniqueCallers = new Set(activeCalls.map((call) => call.callerId));
    const uniqueCounselors = new Set(activeCalls.map((call) => call.counselorId));

    const stats = {
      todayRevenue: {
        payments: todayPayments._sum.amount || 0,
        settlements: todayCompanySettlements._sum.amount || 0,
        total: (todayPayments._sum.amount || 0) + (todayCompanySettlements._sum.amount || 0),
      },
      activeCalls: {
        count: activeCalls.length,
        users: uniqueCallers.size,
        counselors: uniqueCounselors.size,
      },
      pendingRequests,
      newUsersToday,
    };

    return NextResponse.json({
      success: true,
      stats,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: '통계 데이터를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

