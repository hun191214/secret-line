import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 사용자 코인 잔액 조회 API (실시간)
 * GET: 현재 로그인한 사용자의 최신 코인 잔액 조회
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */
export async function GET() {
  // 캐시 제어 헤더 (모든 응답에 적용)
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    // 1. 세션 쿠키 확인 (await cookies() 사용)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      console.error('[실전 로그] 사용자 이메일: 미확인 | 코인 조회 시도 중 인증 실패 - 세션 쿠키 없음');
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    // 2. 세션 파싱 (안전장치 강화)
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

    // 3. 이메일 확인
    const userEmail = session.email;
    if (!userEmail) {
      console.error('[실전 로그] 사용자 이메일: N/A | 코인 조회 시도 중 인증 실패 - 세션에 이메일 정보 없음');
      return NextResponse.json(
        { success: false, message: '세션 정보가 올바르지 않습니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    // console.log 제거 (JSON 응답 간섭 방지)

    // 4. DB 연결 확인 (단 한 번만 호출)
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      console.error(`[실전 로그] 사용자 이메일: ${userEmail} | 코인 조회 시도 중 서버 오류 - DB 연결 실패`);
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503, headers: noCacheHeaders }
      );
    }


    // 5. DB에서 최신 milliGold 잔액 조회
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { milliGold: true, email: true },
      });
    } catch (dbError: any) {
      console.error(`[실전 로그] 사용자 이메일: ${userEmail} | Gold 잔액 조회 시도 중 서버 오류 - DB 조회 실패`);
      console.error(`   → 오류 상세: ${dbError?.message}`);
      return NextResponse.json(
        { success: false, message: 'Gold 잔액 조회 중 오류가 발생했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    // 6. 사용자 존재 여부 확인
    if (!user) {
      console.error(`[실전 로그] 사용자 이메일: ${userEmail} | Gold 잔액 조회 시도 중 인증 실패 - DB에서 사용자를 찾을 수 없습니다.`);
      console.error(`   → 시도 시간: ${new Date().toISOString()}`);
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404, headers: noCacheHeaders }
      );
    }

    // 7. milliGold 값 처리 (null이면 0으로)
    const userMilliGold = user.milliGold ?? 0;

    // 8. 세션 쿠키 업데이트 (동기화)
    cookieStore.set('auth_session', JSON.stringify({
      ...session,
      milliGold: userMilliGold,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // 9. 성공 응답
    return NextResponse.json({
      success: true,
      milliGold: userMilliGold,
      email: user.email,
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error('[실전 로그] 사용자 이메일: 미확인 | 코인 조회 시도 중 예상치 못한 서버 오류');
    console.error(`   → 오류 메시지: ${error?.message}`);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
