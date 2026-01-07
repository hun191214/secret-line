import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 세션 유효성 검증 API (중복 로그인 차단)
 * GET /api/auth/validate-session
 * 
 * 쿠키의 sessionId와 DB의 lastSessionId가 다르면 즉시 로그아웃
 */

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      return NextResponse.json({
        valid: false,
        reason: 'NO_SESSION',
        message: '세션이 없습니다.',
      });
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
      return NextResponse.json({
        valid: false,
        reason: 'INVALID_SESSION_COOKIE',
        message: '세션이 유효하지 않습니다.',
      });
    }

    if (!session.userId || !session.sessionId) {
      return NextResponse.json({
        valid: false,
        reason: 'INCOMPLETE_SESSION',
        message: '세션 정보가 불완전합니다.',
      });
    }

    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      // DB 연결 실패 시에도 일단 유효로 처리 (서비스 중단 방지)
      return NextResponse.json({
        valid: true,
        reason: 'DB_UNAVAILABLE',
        message: 'DB 연결 불가로 검증 생략',
      });
    }

    // DB에서 최신 세션 ID 조회
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        lastSessionId: true,
        role: true,
      },
    });

    if (!user) {
      // 사용자가 삭제된 경우
      cookieStore.delete('auth_session');
      return NextResponse.json({
        valid: false,
        reason: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다.',
        shouldLogout: true,
      });
    }

    // ★★★ 핵심: 세션 ID 비교 (중복 로그인 감지) ★★★
    if (user.lastSessionId && user.lastSessionId !== session.sessionId) {
      // 다른 기기에서 로그인했으므로 현재 세션 무효화
      cookieStore.delete('auth_session');
      // console.log 제거 (JSON 응답 간섭 방지)
      return NextResponse.json({
        valid: false,
        reason: 'DUPLICATE_LOGIN',
        message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.',
        shouldLogout: true,
      });
    }

    // 세션 유효
    return NextResponse.json({
      valid: true,
      reason: 'VALID',
      user: {
        id: user.id,
        role: user.role,
      },
    });
  } catch (error: any) {
    // console.error 제거 (JSON 응답 간섭 방지)
    return NextResponse.json({
      valid: true, // 오류 시에도 일단 유효로 처리 (서비스 중단 방지)
      reason: 'ERROR',
      message: '검증 중 오류 발생',
    });
  }
}

