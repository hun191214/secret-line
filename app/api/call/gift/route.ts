import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 선물 API
 * POST: 통화 중 상담사에게 코인 선물
 * 
 * 선물 가능 금액: 100, 500, 1000 코인
 * 
 * 배분 로직 (홈페이지구축 문서 반영):
 * - 상담사: 60%
 * - 회사(플랫폼): 30%
 * - 추천인: 10% (추천인 없을 시 회사 40%)
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 * ⚠️ 주의: Settlement 테이블에 metadata 필드가 없으므로 사용하지 않음
 */

const VALID_GIFT_MILLIAMOUNTS = [100000, 500000, 1000000]; // milliGold 단위: 100, 500, 1000 Gold

// 배분 비율 (6:3:1 또는 6:4)
const COUNSELOR_RATE = 0.6;  // 60%
const PLATFORM_RATE_WITH_REFERRER = 0.3;  // 30% (추천인 있을 때)
const PLATFORM_RATE_NO_REFERRER = 0.4;    // 40% (추천인 없을 때)
const REFERRER_RATE = 0.1;  // 10%

export async function POST(request: NextRequest) {
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  // ★★★ DB 연결을 최상단에서 먼저 확인 ★★★
  const dbConnected = await ensurePrismaConnected();
  if (!dbConnected) {
    console.error('[선물] 에러: DB 연결 실패 (최상단 체크)');
    return NextResponse.json(
      { success: false, message: '데이터베이스 연결에 실패했습니다.' },
      { status: 503, headers: noCacheHeaders }
    );
  }

  try {
    // 1. 요청 본문 파싱
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error(`[선물] 요청 파싱 오류: ${parseError?.message}`);
      return NextResponse.json(
        { success: false, message: '잘못된 요청 형식입니다.' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const { callId, milliAmount } = body || {};

    // 2. 필수 파라미터 확인
    if (!callId) {
      console.error('[선물] 에러: callId 누락');
      return NextResponse.json(
        { success: false, message: '통화 ID가 필요합니다.' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    if (!milliAmount || typeof milliAmount !== 'number') {
      console.error(`[선물] 에러: milliAmount 누락 또는 잘못된 타입 - 받은 값: ${milliAmount} (${typeof milliAmount})`);
      return NextResponse.json(
        { success: false, message: '선물 금액이 필요합니다.' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 3. 선물 금액 유효성 확인 (milliGold)
    if (!VALID_GIFT_MILLIAMOUNTS.includes(milliAmount)) {
      console.error(`[선물] 에러: 잘못된 선물 금액 - ${milliAmount} milliGold`);
      return NextResponse.json(
        { success: false, message: '유효하지 않은 선물 금액입니다. (100, 500, 1000 Gold 중 선택, milliGold 단위)' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 4. 세션 확인
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie?.value) {
      console.error('[선물] 에러: 세션 쿠키 없음');
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

    const userEmail = session?.email || '알 수 없음';
    const userId = session?.userId;

    if (!userId) {
      console.error(`[선물] 에러: 세션에 userId 없음 - 이메일: ${userEmail}`);
      return NextResponse.json(
        { success: false, message: '사용자 정보를 확인할 수 없습니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    console.log(`🎁 [선물] ${userEmail}이 ${amount}코인 선물 시도 (통화: ${callId})`);

    // 5. 통화 정보 조회 (추천인 정보 포함)
    let call;
    try {
      call = await prisma.call.findUnique({
        where: { id: callId },
        select: {
          id: true,
          status: true,
          callerId: true,
          counselorId: true,
          referralId: true,
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
              name: true,
            },
          },
          referral: {
            select: {
              referrerId: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      console.error(`[선물] 통화 조회 오류: ${dbError?.message}`);
      console.dir(dbError, { depth: null });
      return NextResponse.json(
        { success: false, message: '통화 정보 조회에 실패했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    // 6. 통화 존재 여부 확인
    if (!call) {
      console.error(`[선물] 에러: 통화를 찾을 수 없음 - callId: ${callId}`);
      return NextResponse.json(
        { success: false, message: '통화를 찾을 수 없습니다.' },
        { status: 404, headers: noCacheHeaders }
      );
    }

    // 7. 필수 관계 데이터 확인
    if (!call.caller || !call.caller.id) {
      console.error(`[선물] 에러: 통화에 발신자(caller) 정보 없음 - callId: ${callId}`);
      return NextResponse.json(
        { success: false, message: '발신자 정보를 확인할 수 없습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    if (!call.counselor || !call.counselor.id) {
      console.error(`[선물] 에러: 통화에 상담사(counselor) 정보 없음 - callId: ${callId}`);
      return NextResponse.json(
        { success: false, message: '상담사 정보를 확인할 수 없습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    // 8. 통화 상태 확인 (ACTIVE 상태에서만 선물 가능)
    if (call.status !== 'ACTIVE') {
      console.error(`[선물] 에러: 통화 상태가 ACTIVE가 아님 - status: ${call.status}`);
      return NextResponse.json(
        { success: false, message: '통화 중에만 선물을 보낼 수 있습니다.' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 9. 본인 확인 (이용자만 선물 가능)
    if (call.callerId !== userId) {
      console.error(`[선물] 에러: 본인 통화가 아님 - callerId: ${call.callerId}, userId: ${userId}`);
      return NextResponse.json(
        { success: false, message: '본인의 통화에서만 선물을 보낼 수 있습니다.' },
        { status: 403, headers: noCacheHeaders }
      );
    }

    // 10. 잔액 확인
    const callerMilliGold = call.caller.milliGold ?? 0;
    if (callerMilliGold < milliAmount) {
      console.error(`[선물] 에러: 잔액 부족 - 현재: ${callerMilliGold} milliGold, 필요: ${milliAmount} milliGold`);
      return NextResponse.json(
        { success: false, message: `잔액이 부족합니다. (현재: ${callerMilliGold} milliGold, 필요: ${milliAmount} milliGold)` },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 11. 배분 계산 (6:3:1 또는 6:4)
    const counselorMilliAmount = Math.floor(milliAmount * COUNSELOR_RATE);  // 60%
    let platformMilliAmount: number;
    let referrerMilliAmount = 0;
    let referrerId: string | null = null;

    // 추천인 확인 - 더 엄격한 체크
    // call.referral이 null/undefined이거나 referrerId가 없으면 추천인 없음
    const hasReferrer = call.referral !== null && 
                        call.referral !== undefined && 
                        typeof call.referral.referrerId === 'string' && 
                        call.referral.referrerId.length > 0;
    
    if (hasReferrer) {
      referrerId = call.referral!.referrerId;
      referrerMilliAmount = Math.floor(milliAmount * REFERRER_RATE);  // 10%
      platformMilliAmount = Math.floor(milliAmount * PLATFORM_RATE_WITH_REFERRER);  // 30%
      console.log(`🎁 [선물] 추천인 있음 - ID: ${referrerId} (6:3:1 배분)`);
    } else {
      platformMilliAmount = Math.floor(milliAmount * PLATFORM_RATE_NO_REFERRER);  // 40%
      console.log(`🎁 [선물] 추천인 없음 (6:4 배분)`);
    }

    console.log(`🎁 [선물 배분 상세] 총액: ${amount}코인`);
    console.log(`   → 상담사(${call.counselor.email || 'unknown'}): ${counselorAmount}코인 (60%)`);
    console.log(`   → 플랫폼: ${platformAmount}코인 (${hasReferrer ? '30%' : '40%'})`);
    if (hasReferrer && referrerId) {
      console.log(`   → 추천인(${referrerId}): ${referrerAmount}코인 (10%)`);
    }

    // 12. 트랜잭션으로 선물 처리 (하나의 묶음으로 실행)
    // ★★★ metadata 필드 제거 - Settlement 테이블에 해당 필드 없음 ★★★
    try {
      // 트랜잭션 배열 구성
      const transactions: any[] = [];

      // 12-1. 이용자 잔액 차감
      transactions.push(
        prisma.user.update({
          where: { id: call.callerId },
          data: {
            milliGold: {
              decrement: milliAmount,
            },
          },
        })
      );

      // 12-2. 상담사 수익 가산 (60%)
      transactions.push(
        prisma.user.update({
          where: { id: call.counselorId },
          data: {
            milliGold: {
              increment: counselorMilliAmount,
            },
          },
        })
      );

      // 12-3. 상담사 선물 수익 Settlement 기록 (metadata 제거!)
      transactions.push(
        prisma.settlement.create({
          data: {
            userId: call.counselorId,
            callId: callId,
            amount: counselorMilliAmount,
            type: 'COUNSELOR',
            percentage: COUNSELOR_RATE,
            status: 'COMPLETED',
            settledAt: new Date(),
          },
        })
      );

      // 12-4. 추천인이 있으면 추천인에게도 배분
      if (hasReferrer && referrerId && referrerMilliAmount > 0) {
        transactions.push(
          prisma.user.update({
            where: { id: referrerId },
            data: {
              milliGold: {
                increment: referrerMilliAmount,
              },
            },
          })
        );
      
        transactions.push(
          prisma.settlement.create({
            data: {
              userId: referrerId,
              callId: callId,
              amount: referrerMilliAmount,
              type: 'REFERRER',
              percentage: REFERRER_RATE,
              status: 'COMPLETED',
              settledAt: new Date(),
            },
          })
        );
      }

      // 12-5. 플랫폼 수익 Settlement 기록
      transactions.push(
        prisma.settlement.create({
          data: {
            userId: call.counselorId, // 플랫폼 수익은 상담사 ID를 참조 (시스템 정산용)
            callId: callId,
            amount: platformMilliAmount,
            type: 'COMPANY',
            percentage: hasReferrer ? PLATFORM_RATE_WITH_REFERRER : PLATFORM_RATE_NO_REFERRER,
            status: 'COMPLETED',
            settledAt: new Date(),
          },
        })
      );

      // 트랜잭션 실행 (하나의 묶음으로)
      await prisma.$transaction(transactions);

      console.log(`✅ [선물] 완료!`);
      console.log(`   → 발신자(${call.caller.email}): ${callerMilliGold} → ${callerMilliGold - milliAmount} milliGold`);
      console.log(`   → 상담사(${call.counselor.email}): ${call.counselor.milliGold ?? 0} → ${(call.counselor.milliGold ?? 0) + counselorMilliAmount} milliGold`);
      console.log(`   → 플랫폼 수익: ${platformMilliAmount} milliGold`);
      if (hasReferrer && referrerId) {
        console.log(`   → 추천인 수익: ${referrerMilliAmount} milliGold`);
      }

    } catch (txError: any) {
      // ★★★ console.dir로 전체 에러 객체 출력 ★★★
      console.error(`[선물] ❌ 트랜잭션 오류 발생!`);
      console.error(`   → 에러 메시지: ${txError?.message}`);
      console.error(`   → 에러 코드: ${txError?.code || 'N/A'}`);
      console.dir(txError, { depth: null }); // 전체 에러 객체 상세 출력
      console.error(`   → 관련 데이터:`);
      console.error(`      - callId: ${callId}`);
      console.error(`      - callerId: ${call.callerId}`);
      console.error(`      - counselorId: ${call.counselorId}`);
      console.error(`      - referrerId: ${referrerId || 'null'}`);
      console.error(`      - amount: ${amount}`);
      console.error(`      - counselorAmount: ${counselorAmount}`);
      console.error(`      - platformAmount: ${platformAmount}`);
      console.error(`      - referrerAmount: ${referrerAmount}`);
      
      return NextResponse.json(
        { success: false, message: '선물 처리 중 오류가 발생했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    // 13. 성공 응답 (선물 알림 정보 포함)
    return NextResponse.json({
      success: true,
      message: `${call.counselor.name || '상담사'}님에게 ${milliAmount} milliGold를 선물했습니다!`,
      gift: {
        milliAmount,
        from: call.caller.email || 'unknown',
        to: call.counselor.email || 'unknown',
        remainingMilliGold: callerMilliGold - milliAmount,
        distribution: {
          counselor: counselorMilliAmount,
          platform: platformMilliAmount,
          referrer: referrerMilliAmount,
        },
      },
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    // ★★★ 예상치 못한 최상위 에러 - console.dir 사용 ★★★
    console.error(`[선물] ❌ 예상치 못한 오류!`);
    console.error(`   → 에러 메시지: ${error?.message}`);
    console.error(`   → 에러 이름: ${error?.name}`);
    console.dir(error, { depth: null }); // 전체 에러 객체 상세 출력
    
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
