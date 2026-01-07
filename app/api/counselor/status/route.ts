import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 상담사 상태 관리 API
 * - GET: 현재 상태 조회
 * - POST: 상태 변경 (online/offline)
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    try {
      const cookieValue = sessionCookie.value.trim();
      const session = JSON.parse(cookieValue);
      if (!session || typeof session !== 'object') {
        throw new Error('Invalid session structure');
      }

      // 상담사만 접근 가능
      if (session.role !== 'COUNSELOR') {
        return NextResponse.json(
          { success: false, message: '상담사만 접근 가능합니다.' },
          { status: 403 }
        );
      }

      // DB에서 상태 확인 (우선)
      const isConnected = await ensurePrismaConnected();
      let dbStatus = session.counselorStatus || 'offline';

      if (isConnected && session.email) {
        try {
          const user = await prisma.user.findUnique({
            where: { email: session.email },
            select: {
              status: true,
            },
          });

          if (user?.status) {
            // DB의 status를 세션 형식으로 변환 (ONLINE -> online, OFFLINE -> offline)
            dbStatus = user.status.toLowerCase();
          }
        } catch (dbError: any) {
          console.error('❌ [상담사 상태] DB 조회 오류:', dbError?.message);
          // DB 조회 실패 시 세션 상태 사용
        }
      }

      return NextResponse.json({
        success: true,
        status: dbStatus,
        email: session.email,
      });
    } catch (parseError: any) {
      cookieStore.delete('auth_session');
      return NextResponse.json(
        { success: false, message: '세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.', error: 'INVALID_SESSION_COOKIE' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { status } = body;

    // 상태 검증
    if (status !== 'online' && status !== 'offline') {
      return NextResponse.json(
        { success: false, message: '올바른 상태를 선택해주세요.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    try {
      const cookieValue = sessionCookie.value.trim();
      const session = JSON.parse(cookieValue);
      if (!session || typeof session !== 'object') {
        throw new Error('Invalid session structure');
      }

      // 상담사만 접근 가능
      if (session.role !== 'COUNSELOR') {
        return NextResponse.json(
          { success: false, message: '상담사만 접근 가능합니다.' },
          { status: 403 }
        );
      }

      // ★★★ 승인 상태 확인 (온라인으로 변경하려는 경우만) ★★★
      if (status === 'online') {
        const isConnected = await ensurePrismaConnected();
        if (!isConnected) {
          return NextResponse.json(
            { success: false, message: '데이터베이스 연결에 실패했습니다.' },
            { status: 503 }
          );
        }

        // CounselorProfile 상태 확인
        const profile = await prisma.counselorProfile.findUnique({
          where: { userId: session.userId },
          select: { status: true },
        });

        if (!profile || profile.status !== 'APPROVED') {
          return NextResponse.json(
            { 
              success: false, 
              message: '승인된 상담사만 업무를 시작할 수 있습니다. 현재 상태: ' + (profile?.status === 'PENDING' ? '심사 대기 중' : profile?.status === 'REJECTED' ? '거절됨' : '프로필 없음'),
            },
            { status: 403 }
          );
        }
      }

      // DB에 상태 업데이트
      const isConnected = await ensurePrismaConnected();
      
      if (isConnected) {
        try {
          // DB의 status 필드를 업데이트 (ONLINE/OFFLINE)
          const dbStatus = status === 'online' ? 'ONLINE' : 'OFFLINE';
          await prisma.user.update({
            where: { email: session.email },
            data: {
              status: dbStatus,
              updatedAt: new Date(),
            },
          });
          console.log(`✅ [상담사 상태] ${session.email}의 DB 상태를 ${dbStatus}로 업데이트`);
        } catch (dbError: any) {
          console.error('❌ [상담사 상태] DB 업데이트 오류:', dbError?.message);
          // DB 업데이트 실패해도 세션은 업데이트
        }
      }

      // 세션 쿠키에도 상태 저장 (기존 호환성 유지)
      cookieStore.set('auth_session', JSON.stringify({
        ...session,
        counselorStatus: status,
        statusChangedAt: Date.now(),
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7일
        path: '/',
      });

      return NextResponse.json({
        success: true,
        message: `상태가 '${status === 'online' ? '통화 가능' : '휴식 중'}'으로 변경되었습니다.`,
        status,
      });
    } catch (parseError: any) {
      cookieStore.delete('auth_session');
      return NextResponse.json(
        { success: false, message: '세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.', error: 'INVALID_SESSION_COOKIE' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

