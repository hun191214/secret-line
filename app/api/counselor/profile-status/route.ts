import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 상담사 프로필 상태 조회 API
 * GET /api/counselor/profile-status
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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

      // ★★★ 역할 제한 제거: 모든 사용자가 자신의 상담사 프로필 상태 조회 가능 ★★★
      // MEMBER도 프로필이 있을 수 있으므로 역할 체크 제거

      const isConnected = await ensurePrismaConnected();
      if (!isConnected) {
        return NextResponse.json(
          { success: false, message: '데이터베이스 연결에 실패했습니다.' },
          { status: 503 }
        );
      }

      // CounselorProfile 조회
      const profile = await prisma.counselorProfile.findUnique({
        where: { userId: session.userId },
        select: {
          id: true,
          status: true,
          displayName: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
          rejectedReason: true,
        },
      });

      if (!profile) {
        return NextResponse.json({
          success: true,
          hasProfile: false,
          status: null,
          message: '상담사 프로필이 없습니다.',
        });
      }

      return NextResponse.json({
        success: true,
        hasProfile: true,
        status: profile.status,
        displayName: profile.displayName,
        createdAt: profile.createdAt,
        approvedAt: profile.approvedAt,
        rejectedAt: profile.rejectedAt,
        rejectedReason: profile.rejectedReason,
      });
    } catch {
      return NextResponse.json(
        { success: false, message: '세션 정보를 확인할 수 없습니다.' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('프로필 상태 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

