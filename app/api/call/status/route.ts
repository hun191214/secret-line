import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 통화 상태 조회 API
 * GET: 특정 통화의 현재 상태 조회 (이용자가 수락 여부 확인용)
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 * ⚠️ 주의: Settlement 테이블에 metadata 필드가 없으므로 역산 방식 사용
 */

// 배분 비율 상수 (선물 총액 복원용)
const COUNSELOR_RATE = 0.6;

export async function GET(request: NextRequest) {
  // 캐시 제어 헤더
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

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

    // 3. DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503, headers: noCacheHeaders }
      );
    }

    // 4. 통화 정보 조회 (사용자 정보 포함)
    let call;
    try {
      call = await prisma.call.findUnique({
        where: { id: callId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          callerId: true,
          counselorId: true,
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
              name: true,
              milliGold: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      console.error(`[통화 상태] 조회 오류: ${dbError?.message}`);
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

    // 4-1. 현재 사용자의 최신 코인 잔액 조회 (실시간 반영)
    // ★★★ 매번 DB에서 최신 값을 조회하여 스케줄러 차감 결과가 즉시 반영되도록 함 ★★★
    let userMilliGold = 0;
    try {
      const currentUser = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { milliGold: true },
      });
      userMilliGold = currentUser?.milliGold ?? 0;
      if (call.status === 'ACTIVE') {
        console.log(`💰 [통화 상태] 사용자 ${userEmail} 최신 잔액: ${userMilliGold} milliGold`);
      }
    } catch (userError: any) {
      console.error(`[통화 상태] 사용자 잔액 조회 오류: ${userError?.message}`);
      if (call.caller.email === userEmail) {
        userMilliGold = call.caller.milliGold ?? 0;
      }
    }

    // 5. 선물 총액 집계 (Settlement에서 COUNSELOR 타입만 집계)
    // ★★★ metadata 필드가 없으므로 상담사 수익의 역산으로 원본 선물 금액 계산 ★★★
    let totalMilliGifts = 0;
    try {
      // aggregate로 상담사 수익 합계 조회
      const amountSumResult = await prisma.settlement.aggregate({
        where: {
          callId: callId,
          type: 'COUNSELOR',
          status: 'COMPLETED',
        },
        _sum: {
          milliGold: true,
        },
      });

      const counselorMilliAmountSum = amountSumResult._sum.milliGold || 0;
      if (counselorMilliAmountSum > 0) {
        totalMilliGifts = Math.round(counselorMilliAmountSum / COUNSELOR_RATE);
      }

      console.log(`🎁 [통화 상태] 통화 ${callId} - 상담사 수익 합계: ${counselorMilliAmountSum} milliGold, 역산 선물 총액: ${totalMilliGifts} milliGold`);
    } catch (giftError: any) {
      console.error(`[통화 상태] 선물 집계 오류: ${giftError?.message}`);
      // 집계 실패해도 계속 진행 (totalGifts는 0으로 유지)
    }

    // 6. 성공 응답
    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        status: call.status,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        counselor: {
          id: call.counselor.id,
          name: call.counselor.name || call.counselor.email?.split('@')[0] || '상담사',
        },
        statusMessage: getStatusMessage(call.status),
        totalMilliGifts: totalMilliGifts, // 실시간 집계된 선물 총액 (역산)
      },
      user: {
        milliGold: userMilliGold, // 실시간 milliGold 잔액 (서버 스케줄러로 차감된 최신 값)
      },
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error(`[통화 상태] 예상치 못한 오류: ${error?.message}`);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'INITIATED':
      return '통화 요청 중...';
    case 'CONNECTING':
      return '상담사에게 연결 중...';
    case 'ACTIVE':
      return '연결되었습니다!';
    case 'ENDED':
      return '통화가 종료되었습니다.';
    case 'CANCELLED':
      return '통화가 취소되었습니다.';
    default:
      return '상태 확인 중...';
  }
}
