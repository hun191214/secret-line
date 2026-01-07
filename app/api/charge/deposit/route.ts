import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 코인 충전 API (DB 영구 저장)
 * USDT 입금 → 코인 충전 처리
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */
export async function POST(request: NextRequest) {
  // 캐시 제어 헤더
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    const body = await request.json();
    const { usdtAmount } = body;

    // 1. 입력 검증
    if (!usdtAmount || usdtAmount <= 0) {
      return NextResponse.json(
        { success: false, message: '올바른 USDT 금액을 입력해주세요.' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 2. 세션 확인
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      console.error('[실전 로그] 사용자 이메일: 미확인 | 충전 시도 중 인증 실패 - 세션 쿠키 없음');
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    // 3. 세션 파싱 (안전장치 강화)
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

    // 4. 이메일 확인
    const userEmail = session.email;
    if (!userEmail) {
      console.error('[실전 로그] 사용자 이메일: N/A | 충전 시도 중 인증 실패 - 세션에 이메일 정보 없음');
      return NextResponse.json(
        { success: false, message: '세션 정보가 올바르지 않습니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    console.log(`🔔 [충전 요청] 사용자: ${userEmail}, 금액: ${usdtAmount} USDT`);

    // 5. 환율 계산: 1 USDT = 100 Coins
    const coinsToAdd = Math.floor(usdtAmount * 100);

    // 6. DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      console.error(`[실전 로그] 사용자 이메일: ${userEmail} | 충전 시도 중 서버 오류 - DB 연결 실패`);
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503, headers: noCacheHeaders }
      );
    }

    // 7. 현재 사용자의 코인 잔액 조회
    let currentUser;
    try {
      currentUser = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, coins: true, email: true },
      });
    } catch (dbError: any) {
      console.error(`[실전 로그] 사용자 이메일: ${userEmail} | 충전 시도 중 DB 조회 실패`);
      console.error(`   → 오류 상세: ${dbError?.message}`);
      return NextResponse.json(
        { success: false, message: '사용자 정보 조회 중 오류가 발생했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    if (!currentUser) {
      console.error(`[실전 로그] 사용자 이메일: ${userEmail} | 충전 시도 중 인증 실패 - DB에서 사용자를 찾을 수 없습니다.`);
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404, headers: noCacheHeaders }
      );
    }

    const previousCoins = currentUser.coins ?? 0;
    const newCoins = previousCoins + coinsToAdd;

    // 8. DB에 코인 잔액 업데이트 (영구 저장)
    let updatedUser;
    try {
      updatedUser = await prisma.user.update({
        where: { email: userEmail },
        data: { coins: newCoins },
        select: { id: true, coins: true, email: true },
      });
    } catch (dbError: any) {
      console.error(`[실전 로그] 사용자 이메일: ${userEmail} | 충전 시도 중 DB 업데이트 실패`);
      console.error(`   → 오류 상세: ${dbError?.message}`);
      return NextResponse.json(
        { success: false, message: '코인 충전 처리 중 오류가 발생했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    // 9. DB 저장 확인 (재조회하여 검증)
    let verifiedUser;
    try {
      verifiedUser = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { coins: true },
      });
      console.log(`[DB 확인] 저장된 최종 코인: ${verifiedUser?.coins ?? 0}`);
    } catch {
      console.warn(`[DB 확인] 검증 조회 실패 (충전은 성공했을 수 있음)`);
    }

    // 10. 세션 쿠키도 업데이트 (동기화)
    cookieStore.set('auth_session', JSON.stringify({
      ...session,
      coins: updatedUser.coins,
      lastDepositTime: Date.now(),
      lastDepositAmount: usdtAmount,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log(`✅ [충전 완료] 사용자: ${userEmail}, ${previousCoins} → ${updatedUser.coins} 코인 (+${coinsToAdd})`);

    // 11. 성공 응답
    return NextResponse.json({
      success: true,
      message: '입금이 완료되었습니다.',
      data: {
        usdtAmount,
        coinsAdded: coinsToAdd,
        previousCoins,
        newCoins: updatedUser.coins,
      },
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error('[실전 로그] 사용자 이메일: 미확인 | 충전 시도 중 예상치 못한 서버 오류');
    console.error(`   → 오류 메시지: ${error?.message}`);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
