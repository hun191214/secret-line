import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 상담사 전용 수신 통화 확인 API
 * GET: 현재 로그인한 상담사에게 온 PENDING/CONNECTING 상태의 통화 조회
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
    // 1. 세션 확인
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, hasIncoming: false, message: '로그인이 필요합니다.' },
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
        { success: false, hasIncoming: false, message: '세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.', error: 'INVALID_SESSION_COOKIE' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    // 3. 상담사만 접근 가능
    if (session.role !== 'COUNSELOR') {
      return NextResponse.json(
        { success: false, hasIncoming: false, message: '상담사만 접근할 수 있습니다.' },
        { status: 403, headers: noCacheHeaders }
      );
    }

    const userEmail = session.email;
    if (!userEmail) {
      return NextResponse.json(
        { success: false, hasIncoming: false, message: '세션 정보가 올바르지 않습니다.' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    // 4. DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      return NextResponse.json(
        { success: false, hasIncoming: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503, headers: noCacheHeaders }
      );
    }

    // 5. 현재 상담사의 사용자 ID 조회
    let counselor;
    try {
      counselor = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, email: true, name: true },
      });
    } catch (dbError: any) {
      console.error(`[수신 확인] DB 조회 오류: ${dbError?.message}`);
      return NextResponse.json(
        { success: false, hasIncoming: false, message: '사용자 정보 조회에 실패했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    if (!counselor) {
      return NextResponse.json(
        { success: false, hasIncoming: false, message: '상담사 정보를 찾을 수 없습니다.' },
        { status: 404, headers: noCacheHeaders }
      );
    }

    // 6. CONNECTING 또는 INITIATED 상태인 수신 통화 조회
    let incomingCall;
    try {
      incomingCall = await prisma.call.findFirst({
        where: {
          counselorId: counselor.id,
          status: {
            in: ['INITIATED', 'CONNECTING'],
          },
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          createdAt: true,
          caller: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (dbError: any) {
      console.error(`[수신 확인] 통화 조회 오류: ${dbError?.message}`);
      return NextResponse.json(
        { success: false, hasIncoming: false, message: '통화 정보 조회에 실패했습니다.' },
        { status: 500, headers: noCacheHeaders }
      );
    }

    // 7. 수신 통화가 있는 경우
    if (incomingCall) {
      console.log(`📞 [수신 확인] 상담사 ${userEmail}에게 수신 통화 있음: ${incomingCall.id}`);
      return NextResponse.json({
        success: true,
        hasIncoming: true,
        call: {
          id: incomingCall.id,
          status: incomingCall.status,
          startedAt: incomingCall.startedAt,
          createdAt: incomingCall.createdAt,
          caller: {
            id: incomingCall.caller.id,
            name: incomingCall.caller.name || incomingCall.caller.email?.split('@')[0] || '익명',
          },
        },
      }, { headers: noCacheHeaders });
    }

    // 8. 수신 통화가 없는 경우
    return NextResponse.json({
      success: true,
      hasIncoming: false,
      call: null,
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error(`[수신 확인] 예상치 못한 오류: ${error?.message}`);
    return NextResponse.json(
      { success: false, hasIncoming: false, message: '서버 오류가 발생했습니다.' },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

