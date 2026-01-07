import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 상담사 통계 조회 API (상담 수익 + 선물 수익 통합)
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */
export async function GET() {
  // 캐시 제어 헤더
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    let session;
    try {
      const cookieValue = sessionCookie.value.trim();
      session = JSON.parse(cookieValue);
      if (!session || typeof session !== 'object') {
        throw new Error('Invalid session structure');
      }
    } catch (parseError: any) {
      cookieStore.delete('auth_session');
      return NextResponse.json(
        { success: false, message: '세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.', error: 'INVALID_SESSION_COOKIE' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    // 상담사만 접근 가능
    if (session.role !== 'COUNSELOR') {
      return NextResponse.json(
        { success: false, message: '상담사만 접근 가능합니다.' },
        { status: 403, headers: noCacheHeaders }
      );
    }

    const userEmail = session.email;
    if (!userEmail) {
      return NextResponse.json(
        { success: false, message: '세션 정보가 올바르지 않습니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    // DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      return NextResponse.json({
        success: true,
        consultationEarnings: 0,
        giftEarnings: 0,
        totalTodayEarnings: 0,
        totalCoins: 0,
        source: 'fallback',
      }, { headers: noCacheHeaders });
    }

    // 상담사 정보 조회 (현재 코인 잔액)
    let counselor;
    try {
      counselor = await prisma.user.findUnique({
        where: { email: userEmail },
        select: {
          id: true,
          coins: true,
        },
      });
    } catch (dbError: any) {
      console.error(`[상담사 통계] 사용자 조회 오류: ${dbError?.message}`);
      return NextResponse.json({
        success: true,
        consultationEarnings: 0,
        giftEarnings: 0,
        totalTodayEarnings: 0,
        totalCoins: 0,
        source: 'error',
      }, { headers: noCacheHeaders });
    }

    if (!counselor) {
      return NextResponse.json(
        { success: false, message: '상담사 정보를 찾을 수 없습니다.' },
        { status: 404, headers: noCacheHeaders }
      );
    }

    // 오늘 날짜 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. 오늘 완료된 통화에서 상담 수익 계산 (60% 배분)
    // ★★★ 15초 미만 통화는 과금되지 않으므로 수익 계산에서 제외 ★★★
    const MIN_BILLING_SECONDS = 15; // 최소 과금 시간 (초)
    
    let consultationEarnings = 0;
    try {
      const todayCalls = await prisma.call.findMany({
        where: {
          counselorId: counselor.id,
          status: 'ENDED',
          endedAt: {
            gte: today,
            lt: tomorrow,
          },
          // 15초 미만 통화는 cost가 0이므로 필터링
          cost: {
            gt: 0, // cost > 0인 통화만 (15초 이상 통화)
          },
        },
        select: {
          duration: true,
          cost: true, // cost 필드도 확인
        },
      });

      // 상담 수익 계산: 분당 14코인, 60% 배분
      // ★★★ cost > 0인 통화만 계산 (15초 미만 통화는 cost = 0) ★★★
      consultationEarnings = todayCalls.reduce((sum, call) => {
        // cost가 0이면 과금되지 않은 통화 (15초 미만)이므로 제외
        if (!call.cost || call.cost === 0) {
          return sum;
        }
        
        // duration이 15초 미만이면 제외 (이중 체크)
        const durationSeconds = call.duration || 0;
        if (durationSeconds < MIN_BILLING_SECONDS) {
          return sum;
        }
        
        const durationMinutes = Math.ceil(durationSeconds / 60);
        const earnings = Math.floor(durationMinutes * 14 * 0.6); // 14코인/분 * 60%
        return sum + earnings;
      }, 0);

      console.log(`📊 [상담사 통계] ${userEmail}: 상담 수익 ${consultationEarnings}코인 (${todayCalls.length}건, 15초 이상 통화만 계산)`);
    } catch (dbError: any) {
      console.error(`[상담사 통계] 통화 조회 오류: ${dbError?.message}`);
    }

    // 2. 오늘 완료된 Settlement 중 COUNSELOR 타입에서 선물 수익 합산
    // ★★★ metadata 필드가 없으므로 상담사 수익의 역산으로 선물 금액 계산 ★★★
    let giftEarnings = 0;
    try {
      // 오늘 완료된 상담사 선물 Settlement 합계
      const giftSettlements = await prisma.settlement.aggregate({
        where: {
          userId: counselor.id,
          type: 'COUNSELOR',
          status: 'COMPLETED',
          settledAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const counselorGiftAmountSum = giftSettlements._sum.amount || 0;

      // 상담사 수익(60%)에서 원본 선물 금액 역산
      // 원본 선물 금액 = 상담사 수익 / 0.6
      // 선물 수익은 상담사가 받은 60% 금액 (counselorGiftAmountSum)
      giftEarnings = counselorGiftAmountSum;

      console.log(`🎁 [상담사 통계] ${userEmail}: 선물 수익 ${giftEarnings}코인 (상담사가 받은 60% 금액)`);
    } catch (giftError: any) {
      console.error(`[상담사 통계] 선물 수익 조회 오류: ${giftError?.message}`);
    }

    // 3. 총 오늘 수익 계산
    const totalTodayEarnings = consultationEarnings + giftEarnings;

    // 4. DB 검증: 실제 코인 잔액 확인 (참고용)
    const totalCoins = counselor.coins ?? 0;

    console.log(`💰 [상담사 통계] ${userEmail}: 총 오늘 수익 ${totalTodayEarnings}코인 (상담: ${consultationEarnings}코인, 선물: ${giftEarnings}코인, 잔액: ${totalCoins}코인)`);

    return NextResponse.json({
      success: true,
      consultationEarnings,
      giftEarnings,
      totalTodayEarnings,
      totalCoins,
      source: 'database',
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error(`[상담사 통계] 예상치 못한 오류: ${error?.message}`);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
