import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 상담사 목록 조회 API
 * GET /api/admin/counselors - 모든 상담사 목록 반환
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // SUPER, OPERATOR 허용
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
    if (!guard.authorized) {
      return NextResponse.json(
        { success: false, message: guard.message },
        { status: guard.status }
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

    // 모든 상담사 조회 (프로필 포함)
    const counselors = await prisma.user.findMany({
      where: {
        role: 'COUNSELOR',
      },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        status: true,
        region: true,
        country: true,
        languages: true,
        coins: true,
        createdAt: true,
        counselorProfile: {
          select: {
            displayName: true,
            country: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      counselors: counselors.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name,
        displayName: c.counselorProfile?.displayName || c.nickname || c.name,
        status: c.status || 'OFFLINE',
        region: c.region,
        country: c.counselorProfile?.country || c.country, // 프로필의 국가 우선
        languages: c.languages,
        coins: c.coins,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('상담사 목록 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '상담사 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

