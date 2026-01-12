import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 관리자 대시보드 통계 API
 * - 오늘의 총수익 (금일 결제된 USDT 합계 및 코인 정산 수수료)
 * - 현재 실시간 통화 중인 유저/상담사 수
 * - 미처리 상담사 신청 건수 (Pending)
 * - 금일 신규 가입자 수
 * 
 * 최적화:
 * - 인메모리 캐싱 (30초 TTL)
 * - 불필요한 연결 체크 제거
 * - 쿼리 병렬 실행
 */

// 인메모리 캐시
let statsCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_TTL = 30 * 1000; // 30초

export async function GET() {
  console.log('[Admin Stats API] 요청 시작:', new Date().toISOString());
  
  try {
    // 캐시 확인 (30초 이내면 캐시된 데이터 반환)
    const now = Date.now();
    if (statsCache && (now - statsCache.timestamp) < CACHE_TTL) {
      console.log('[Admin Stats API] 캐시 히트 - 캐시된 데이터 반환');
      return NextResponse.json({
        success: true,
        stats: statsCache.data,
        updatedAt: new Date(statsCache.timestamp).toISOString(),
        cached: true,
      });
    }
    console.log('[Admin Stats API] 캐시 미스 - DB 쿼리 실행');

    // 오늘 날짜 범위 계산 (UTC 기준)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    console.log('[Admin Stats API] 날짜 범위:', { today: today.toISOString(), tomorrow: tomorrow.toISOString() });

    // 각 쿼리를 개별 실행하여 에러 위치 파악
    let todayPayments, todayCompanySettlements, activeCallsCount, pendingRequests, newUsersToday;

    // 1. 오늘 완료된 결제 금액 합계
    console.log('[Admin Stats API] 쿼리 1/5: Payment aggregate 시작...');
    try {
      todayPayments = await prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: {
          milliAmount: true,
        },
      });
      console.log('[Admin Stats API] 쿼리 1/5: Payment aggregate 완료:', todayPayments);
    } catch (e) {
      console.error('[Admin Stats API] 쿼리 1/5: Payment aggregate 실패:', e);
      throw e;
    }

    // 2. 오늘 회사 정산 금액 합계 (COMPANY 타입) - 실패 시 0으로 처리
    console.log('[Admin Stats API] 쿼리 2/5: Settlement aggregate 시작...');
    try {
      // 먼저 테이블 존재 여부 확인을 위해 간단한 count 시도
      const settlementCount = await prisma.settlement.count();
      console.log('[Admin Stats API] Settlement 테이블 레코드 수:', settlementCount);
      
      if (settlementCount > 0) {
        todayCompanySettlements = await prisma.settlement.aggregate({
          where: {
            type: 'COMPANY',
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          _sum: {
            milliGold: true,
          },
        });
      } else {
        // 테이블이 비어있으면 기본값
        todayCompanySettlements = { _sum: { milliGold: null } };
      }
      console.log('[Admin Stats API] 쿼리 2/5: Settlement aggregate 완료:', todayCompanySettlements);
    } catch (e) {
      // Settlement 쿼리 실패 시 0으로 처리 (테이블 미존재 등)
      console.error('[Admin Stats API] 쿼리 2/5: Settlement aggregate 실패 (0으로 처리):', e);
      todayCompanySettlements = { _sum: { milliGold: null } };
    }

    // 3. 현재 진행 중인 통화 수
    console.log('[Admin Stats API] 쿼리 3/5: Call count 시작...');
    try {
      activeCallsCount = await prisma.call.count({
        where: {
          status: 'ACTIVE',
        },
      });
      console.log('[Admin Stats API] 쿼리 3/5: Call count 완료:', activeCallsCount);
    } catch (e) {
      console.error('[Admin Stats API] 쿼리 3/5: Call count 실패:', e);
      throw e;
    }

    // 4. 미처리 상담사 신청 건수
    console.log('[Admin Stats API] 쿼리 4/5: CounselorProfile count 시작...');
    try {
      pendingRequests = await prisma.counselorProfile.count({
        where: {
          status: 'PENDING',
        },
      });
      console.log('[Admin Stats API] 쿼리 4/5: CounselorProfile count 완료:', pendingRequests);
    } catch (e) {
      console.error('[Admin Stats API] 쿼리 4/5: CounselorProfile count 실패:', e);
      throw e;
    }

    // 5. 오늘 신규 가입자 수
    console.log('[Admin Stats API] 쿼리 5/5: User count 시작...');
    try {
      newUsersToday = await prisma.user.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
      console.log('[Admin Stats API] 쿼리 5/5: User count 완료:', newUsersToday);
    } catch (e) {
      console.error('[Admin Stats API] 쿼리 5/5: User count 실패:', e);
      throw e;
    }

    console.log('[Admin Stats API] 모든 쿼리 완료');

    const stats = {
      todayRevenue: {
        payments: todayPayments._sum.milliAmount || 0,
        settlements: todayCompanySettlements._sum.milliGold || 0,
        total: (todayPayments._sum.milliAmount || 0) + (todayCompanySettlements._sum.milliGold || 0),
      },
      activeCalls: {
        count: activeCallsCount,
        // 실시간 통화 중인 고유 유저/상담사 수는 별도 쿼리 필요 시 추가
        // 현재는 성능상 통화 건수만 표시
        users: activeCallsCount,
        counselors: activeCallsCount,
      },
      pendingRequests,
      newUsersToday,
    };

    // 캐시 업데이트
    statsCache = {
      data: stats,
      timestamp: now,
    };

    console.log('[Admin Stats API] 응답 반환 성공');
    return NextResponse.json({
      success: true,
      stats,
      updatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('[Admin Stats API] 에러 발생:', error);
    console.error('[Admin Stats API] 에러 타입:', typeof error);
    console.error('[Admin Stats API] 에러 메시지:', error instanceof Error ? error.message : String(error));
    console.error('[Admin Stats API] 에러 스택:', error instanceof Error ? error.stack : 'N/A');
    
    // 에러 발생 시에도 캐시된 데이터가 있으면 반환
    if (statsCache) {
      return NextResponse.json({
        success: true,
        stats: statsCache.data,
        updatedAt: new Date(statsCache.timestamp).toISOString(),
        cached: true,
        stale: true,
      });
    }

    // 캐시도 없으면 기본값 반환
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
      error: '통계 데이터를 가져오는 중 오류가 발생했습니다.',
    });
  }
}
