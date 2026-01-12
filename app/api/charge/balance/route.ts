import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
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
      return NextResponse.json({
        success: false,
        authenticated: false,
        milliGold: 0,
      }, { headers: noCacheHeaders });
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
      return NextResponse.json({
        success: false,
        authenticated: false,
        milliGold: 0,
        error: 'INVALID_SESSION_COOKIE',
      }, { headers: noCacheHeaders });
    }
    const userEmail = session.email;
    let userMilliGold;
    if (!userEmail) {
      return NextResponse.json({
        authenticated: false,
        milliGold: 0,
      }, { headers: noCacheHeaders });
    }
    // DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      console.warn(`[잔액 조회] DB 연결 실패, 세션 값 사용: ${session.milliGold || 0}`);
      return NextResponse.json({
        success: true,
        authenticated: true,
        milliGold: session.milliGold || 0,
        source: 'session',
      }, { headers: noCacheHeaders });
    }
    // DB에서 최신 milliGold 잔액 조회
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { milliGold: true },
      });
    } catch (dbError: any) {
      console.error(`[잔액 조회] DB 조회 실패: ${dbError?.message}`);
      return NextResponse.json({
        success: true,
        authenticated: true,
        milliGold: session.milliGold || 0,
        source: 'session',
      }, { headers: noCacheHeaders });
    }
    if (!user) {
      return NextResponse.json({
        success: false,
        authenticated: true,
        milliGold: 0,
        message: '사용자를 찾을 수 없습니다.',
      }, { headers: noCacheHeaders });
    }
    userMilliGold = user.milliGold ?? 0;
    // 세션 쿠키도 업데이트 (동기화)
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
    return NextResponse.json({
      success: true,
      authenticated: true,
      milliGold: userMilliGold,
      source: 'database',
    }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error(`[잔액 조회] 예상치 못한 오류: ${error?.message}`);
    return NextResponse.json({
      success: false,
      authenticated: false,
      milliGold: 0,
    }, { headers: noCacheHeaders });
  }
}
