import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 세션 갱신 API (Silent Refresh)
 * GET /api/auth/refresh-session
 * 
 * DB의 최신 role 정보를 세션에 반영
 */

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '세션이 없습니다.' },
        { status: 401 }
      );
    }

    let session;
    try {
      // ★★★ 쿠키 값 정리 (앞뒤 공백 제거) ★★★
      const cookieValue = sessionCookie.value.trim();
      session = JSON.parse(cookieValue);
      
      // 세션 객체 구조 검증
      if (!session || typeof session !== 'object') {
        throw new Error('Invalid session structure');
      }
    } catch (parseError: any) {
      cookieStore.delete('auth_session');
      return NextResponse.json(
        { success: false, message: '세션이 유효하지 않습니다.', error: 'INVALID_SESSION_COOKIE' },
        { status: 401 }
      );
    }

    if (!session.userId) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 세션입니다.' },
        { status: 401 }
      );
    }

    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // DB에서 최신 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        gender: true,
        counselorProfile: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 세션과 DB의 role이 다른 경우 세션 업데이트
    const roleChanged = session.role !== user.role;

    if (roleChanged) {
      // 세션 쿠키 업데이트
      const updatedSession = {
        ...session,
        role: user.role,
        email: user.email || session.email,
        name: user.name || session.name,
        gender: user.gender || session.gender,
      };

      cookieStore.set('auth_session', JSON.stringify(updatedSession), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7일
        path: '/',
      });

      // console.log 제거 (JSON 응답 간섭 방지)

      return NextResponse.json({
        success: true,
        roleChanged: true,
        oldRole: session.role,
        newRole: user.role,
        shouldReload: true, // ★★★ 강제 리로드 플래그 ★★★
        user: updatedSession,
      });
    }

    // role이 동일하면 그대로 반환
    return NextResponse.json({
      success: true,
      roleChanged: false,
      shouldReload: false,
      user: {
        ...session,
        email: user.email || session.email,
        name: user.name || session.name,
        gender: user.gender || session.gender,
      },
    });
  } catch (error: any) {
    // console.error 제거 (JSON 응답 간섭 방지)
    return NextResponse.json(
      { success: false, message: '세션 갱신 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

