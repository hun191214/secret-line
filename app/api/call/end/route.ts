import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 통화 종료 API
 * POST: 통화를 종료하고 상태를 ENDED로 변경 + 즉시 과금 처리
 * 
 * 과금 로직:
 * - 이용자: 14코인/분 차감
 * - 상담사: 8코인/분 (약 60%) 가산
 * - 플랫폼: 6코인/분 (약 40%) 기록
 * 
 * 낙구 방지:
 * - 15초 미만 통화는 과금하지 않음
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

const COST_PER_MINUTE_MILLI = 14000; // 1분당 14,000 milliGold (14 Gold)
const COUNSELOR_EARNINGS_PER_MINUTE_MILLI = 8000; // 상담사 60% (8 Gold)
const PLATFORM_EARNINGS_PER_MINUTE_MILLI = 6000; // 플랫폼 40% (6 Gold)
const MIN_BILLING_SECONDS = 15; // 최소 과금 시간 (초)

export async function POST(request: NextRequest) {
  // 캐시 제어 헤더
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    const body = await request.json();
    const { callId } = body;

    // 1. 필수 파라미터 확인
    if (!callId) {
      return NextResponse.json(
        { success: false, message: '통화 ID가 필요합니다.' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 2. 세션 확인
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

    const userEmail = session.email;
    console.log(`📴 [통화 종료] ${userEmail}이 통화 ${callId} 종료 시도`);

    // 3. DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503, headers: noCacheHeaders }
      );
    }

    // 4. 통화 정보 조회 (이용자 및 상담사 정보 포함)
    let call;
    try {
      call = await prisma.call.findUnique({
        where: { id: callId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          callerId: true,
          counselorId: true,
          duration: true,
          caller: {
            select: {
              id: true,
              email: true,
              coins: true,
            },
          },
          counselor: {
            select: {
              id: true,
              email: true,
              coins: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      console.error(`[통화 종료] 조회 오류: ${dbError?.message}`);
      return NextResponse.json(
        { success: false, message: '통화 정보 조회에 실패했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    if (!call) {
      return NextResponse.json(
        { success: false, message: '통화를 찾을 수 없습니다.' },
        { status: 404, headers: noCacheHeaders }
      );
    }

    // 5. 이미 종료된 통화인지 확인
    if (call.status === 'ENDED' || call.status === 'CANCELLED') {
      return NextResponse.json(
        { success: false, message: '이미 종료된 통화입니다.' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 6. 실제 경과 시간 계산
    const endedAt = new Date();
    let duration = 0;
    if (call.startedAt) {
      duration = Math.floor((endedAt.getTime() - new Date(call.startedAt).getTime()) / 1000);
    }

    // 7. 낙구 방지: 15초 미만 통화는 과금하지 않음
    if (duration < MIN_BILLING_SECONDS) {
      console.log(`⚠️ [낙구 방지] 통화 ${callId}는 ${duration}초로 최소 과금 시간(${MIN_BILLING_SECONDS}초) 미만입니다.`);
      console.log(`   → 코인 차감 없이 통화 종료 처리됩니다.`);

      // 통화 상태만 종료로 변경 (과금 없음)
      try {
        await prisma.call.update({
          where: { id: callId },
          data: {
            status: 'ENDED',
            endedAt,
            duration,
            cost: 0, // 과금 없음
          },
        });
      } catch (dbError: any) {
        console.error(`[통화 종료] 상태 업데이트 오류: ${dbError?.message}`);
      }

      return NextResponse.json({
        success: true,
        message: `통화가 종료되었습니다. (${duration}초 미만 통화로 과금 없음)`,
        call: {
          id: callId,
          status: 'ENDED',
          duration,
          durationMinutes: 0,
          cost: 0,
          coinsDeducted: 0,
          counselorEarnings: 0,
          platformEarnings: 0,
          noBilling: true,
          reason: `${MIN_BILLING_SECONDS}초 미만 통화`,
        },
      }, { headers: noCacheHeaders });
    }

    // 8. 통화 비용 계산 (15초 이상인 경우만)
    const durationMinutes = Math.ceil(duration / 60); // 올림 (1초라도 1분으로 계산)
    const totalMilliGoldToDeduct = durationMinutes * COST_PER_MINUTE_MILLI;
    const counselorMilliEarnings = durationMinutes * COUNSELOR_EARNINGS_PER_MINUTE_MILLI;
    const platformMilliEarnings = durationMinutes * PLATFORM_EARNINGS_PER_MINUTE_MILLI;
    const costUSD = durationMinutes * 0.14;

    // 9. 이용자 잔액 확인
    const callerMilliGold = call.caller.milliGold ?? 0;
    const actualMilliDeduction = Math.min(totalMilliGoldToDeduct, callerMilliGold); // 잔액보다 많으면 잔액만큼만 차감

    console.log(`💰 [과금] 통화 ${callId} 최종 정산:`);
    console.log(`   → 통화 시간: ${duration}초 (${durationMinutes}분)`);
    console.log(`   → 이용자 잔액: ${callerMilliGold} milliGold`);
    console.log(`   → 차감 예정: ${totalMilliGoldToDeduct} milliGold (실제: ${actualMilliDeduction} milliGold)`);
    console.log(`   → 상담사 수익: ${counselorMilliEarnings} milliGold (60%)`);
    console.log(`   → 플랫폼 수익: ${platformMilliEarnings} milliGold (40%)`);

    // 10. 트랜잭션으로 과금 및 종료 처리
    try {
      await prisma.$transaction([
        // 1. 이용자 잔액 차감
        prisma.user.update({
          where: { id: call.callerId },
          data: {
            milliGold: {
              decrement: actualMilliDeduction,
            },
          },
        }),
        // 2. 상담사 수익 가산
        prisma.user.update({
          where: { id: call.counselorId },
          data: {
            milliGold: {
              increment: counselorMilliEarnings,
            },
          },
        }),
        // 3. 통화 상태 종료로 변경
        prisma.call.update({
          where: { id: callId },
          data: {
            status: 'ENDED',
            endedAt,
            duration,
            cost: costUSD,
          },
        }),
      ]);

      console.log(`✅ [통화 종료] 통화 ${callId} 과금 및 종료 완료`);
      console.log(`   → 이용자 ${call.caller.email}: ${callerMilliGold} → ${callerMilliGold - actualMilliDeduction} milliGold`);
      console.log(`   → 상담사 ${call.counselor.email}: ${call.counselor.milliGold ?? 0} → ${(call.counselor.milliGold ?? 0) + counselorMilliEarnings} milliGold`);
    } catch (txError: any) {
      console.error(`[통화 종료] 트랜잭션 오류: ${txError?.message}`);
      
      // 트랜잭션 실패 시에도 통화는 종료 처리
      try {
        await prisma.call.update({
          where: { id: callId },
          data: {
            status: 'ENDED',
            endedAt,
            duration,
            cost: costUSD,
          },
        });
        console.warn(`⚠️ [통화 종료] 과금 실패했지만 통화는 종료 처리됨`);
      } catch {
        // 무시
      }

      return NextResponse.json({
        success: true,
        message: '통화가 종료되었습니다. (과금 처리 지연)',
        call: {
          id: callId,
          status: 'ENDED',
          duration,
          durationMinutes,
          billingFailed: true,
        },
      }, { headers: noCacheHeaders });
    }

    // 11. 성공 응답
    return NextResponse.json({
      success: true,
      message: '통화가 종료되었습니다.',
      call: {
        id: callId,
        status: 'ENDED',
        duration,
        durationMinutes,
        cost: costUSD,
        coinsDeducted: actualDeduction,
        counselorEarnings,
        platformEarnings,
      },
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error(`[통화 종료] 예상치 못한 오류: ${error?.message}`);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
