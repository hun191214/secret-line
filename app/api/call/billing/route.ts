import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 실시간 과금 백그라운드 API
 * POST: ACTIVE 상태인 통화에 대해 1분마다 과금 처리
 * 
 * 과금 로직:
 * - 이용자: 14코인/분 차감
 * - 상담사: 8.4코인/분 (60%) 가산
 * - 플랫폼: 5.6코인/분 (40%) 기록
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

const COST_PER_MINUTE = 14; // 1분당 14코인
const COUNSELOR_SHARE = 0.6; // 상담사 60%
const PLATFORM_SHARE = 0.4; // 플랫폼 40%

export async function POST() {
  // 캐시 제어 헤더
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    // 1. DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503, headers: noCacheHeaders }
      );
    }

    // 2. ACTIVE 상태인 모든 통화 조회
    let activeCalls;
    try {
      activeCalls = await prisma.call.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          callerId: true,
          counselorId: true,
          startedAt: true,
          duration: true,
          caller: {
            select: {
              id: true,
              email: true,
              milliGold: true,
            },
          },
          counselor: {
            select: {
              id: true,
              email: true,
              milliGold: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      console.error(`[과금] 통화 조회 오류: ${dbError?.message}`);
      return NextResponse.json(
        { success: false, message: '통화 조회에 실패했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    if (activeCalls.length === 0) {
      return NextResponse.json({
        success: true,
        message: '과금할 통화가 없습니다.',
        processed: 0,
      }, { headers: noCacheHeaders });
    }

    console.log(`💰 [과금] ACTIVE 상태인 통화 ${activeCalls.length}건 처리 시작`);

    // 3. 각 통화에 대해 과금 처리
    const results = [];
    for (const call of activeCalls) {
      try {
        const result = await processCallBilling(call);
        results.push(result);
      } catch (error: any) {
        console.error(`[과금] 통화 ${call.id} 처리 오류: ${error?.message}`);
        results.push({
          callId: call.id,
          success: false,
          error: error?.message,
        });
      }
    }

    // 4. 결과 반환
    const successCount = results.filter((r) => r.success).length;
    const endedCount = results.filter((r) => r.ended).length;

    return NextResponse.json({
      success: true,
      message: `과금 처리 완료: ${successCount}/${activeCalls.length}건`,
      processed: successCount,
      ended: endedCount,
      details: results,
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error(`[과금] 예상치 못한 오류: ${error?.message}`);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

// 개별 통화 과금 처리
async function processCallBilling(call: any) {
  const { id: callId, callerId, counselorId, startedAt, caller, counselor } = call;

  // 시작 시간이 없으면 스킵
  if (!startedAt) {
    return {
      callId,
      success: false,
      error: '시작 시간이 없습니다.',
    };
  }

  // 경과 시간 계산 (초)
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  // 이미 과금된 분 수 확인 (duration은 마지막으로 과금된 시점까지의 초)
  const lastBilledSeconds = call.duration || 0;
  const lastBilledMinutes = Math.floor(lastBilledSeconds / 60);

  // 새로 과금할 분 수
  const minutesToBill = elapsedMinutes - lastBilledMinutes;

  if (minutesToBill <= 0) {
    return {
      callId,
      success: true,
      billed: false,
      message: '과금할 시간이 없습니다.',
      elapsedSeconds,
      elapsedMinutes,
    };
  }

  // 과금할 코인 계산
  const milliGoldToDeduct = minutesToBill * COST_PER_MINUTE;
  const counselorEarnings = Math.floor(milliGoldToDeduct * COUNSELOR_SHARE * 10) / 10; // 8.4 milliGold
  const platformEarnings = Math.floor(milliGoldToDeduct * PLATFORM_SHARE * 10) / 10; // 5.6 milliGold

  // 이용자 잔액 확인
  const callerMilliGold = caller.milliGold ?? 0;

  console.log(`💰 [과금] 통화 ${callId}:`);
  console.log(`   → 경과 시간: ${elapsedMinutes}분 (${elapsedSeconds}초)`);
  console.log(`   → 이번 과금: ${minutesToBill}분 = ${milliGoldToDeduct} milliGold`);
  console.log(`   → 이용자 잔액: ${callerMilliGold} milliGold`);

  // 잔액 부족 체크
  if (callerMilliGold < milliGoldToDeduct) {
    console.log(`⚠️ [과금] 잔액 부족으로 통화 강제 종료: ${callId}`);
    
    // 통화 강제 종료
    try {
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'ENDED',
          endedAt: now,
          duration: elapsedSeconds,
          milliCost: lastBilledMinutes * COST_PER_MINUTE, // 1/1000 Gold 단위 정수
        },
      });
    } catch (endError: any) {
      console.error(`[과금] 통화 종료 실패: ${endError?.message}`);
    }

    return {
      callId,
      success: true,
      ended: true,
      reason: '잔액 부족',
      callerMilliGold,
      requiredMilliGold: milliGoldToDeduct,
    };
  }

  // 트랜잭션으로 과금 처리
  try {
    await prisma.$transaction([
      // 1. 이용자 잔액 차감
      prisma.user.update({
        where: { id: callerId },
        data: {
          milliGold: {
            decrement: milliGoldToDeduct,
          },
        },
      }),
      // 2. 상담사 수익 가산
      prisma.user.update({
        where: { id: counselorId },
        data: {
          milliGold: {
            increment: Math.floor(counselorEarnings),
          },
        },
      }),
      // 3. 통화 기록 업데이트 (과금된 시간 기록)
      prisma.call.update({
        where: { id: callId },
        data: {
          duration: elapsedMinutes * 60, // 과금된 분까지의 초
          milliCost: elapsedMinutes * COST_PER_MINUTE, // 1/1000 Gold 단위 정수
        },
      }),
    ]);

    console.log(`✅ [과금] 통화 ${callId} 과금 완료:`);
    console.log(`   → 이용자 차감: ${milliGoldToDeduct} milliGold`);
    console.log(`   → 상담사 수익: ${counselorEarnings} milliGold (60%)`);
    console.log(`   → 플랫폼 수익: ${platformEarnings} milliGold (40%)`);

    return {
      callId,
      success: true,
      billed: true,
      minutesBilled: minutesToBill,
      milliGoldDeducted: milliGoldToDeduct,
      counselorEarnings,
      platformEarnings,
      callerNewBalance: callerMilliGold - milliGoldToDeduct,
    };
  } catch (txError: any) {
    console.error(`[과금] 트랜잭션 오류: ${txError?.message}`);
    return {
      callId,
      success: false,
      error: txError?.message,
    };
  }
}

// GET: 현재 활성 통화의 과금 상태 조회
export async function GET() {
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503, headers: noCacheHeaders }
      );
    }

    const activeCalls = await prisma.call.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        startedAt: true,
        duration: true,
        caller: {
          select: {
            email: true,
            milliGold: true,
          },
        },
        counselor: {
          select: {
            email: true,
            milliGold: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      activeCalls: activeCalls.length,
      calls: activeCalls.map((call) => ({
        id: call.id,
        startedAt: call.startedAt,
        duration: call.duration,
        callerEmail: call.caller.email,
        callerMilliGold: call.caller.milliGold,
        counselorEmail: call.counselor.email,
        counselorMilliGold: call.counselor.milliGold,
      })),
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

