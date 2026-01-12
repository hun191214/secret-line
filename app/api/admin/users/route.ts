import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 유저 목록 조회 API
 * GET /api/admin/users?role=MEMBER|COUNSELOR|ALL
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

    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role') || 'ALL';

    // 필터 조건
    const whereClause: any = {};
    if (roleFilter === 'MEMBER') {
      whereClause.role = 'MEMBER';
    } else if (roleFilter === 'COUNSELOR') {
      whereClause.role = 'COUNSELOR';
    }
    // ALL이면 조건 없음 (ADMIN 포함)

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        role: true,
        adminRole: true,
        gender: true,
        milliGold: true,
        status: true,
        createdAt: true,
        counselorProfile: {
          select: {
            displayName: true,
            status: true,
            country: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 통계
    const stats = {
      totalMembers: users.filter((u) => u.role === 'MEMBER').length,
      totalCounselors: users.filter((u) => u.role === 'COUNSELOR').length,
      onlineCounselors: users.filter(
        (u) => u.role === 'COUNSELOR' && u.status === 'ONLINE'
      ).length,
    };

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        nickname: u.nickname,
        displayName:
          u.counselorProfile?.displayName || u.nickname || u.name || u.email?.split('@')[0],
        role: u.role,
        adminRole: u.adminRole,
        gender: u.gender,
        milliGold: u.milliGold,
        status: u.status,
        counselorStatus: u.counselorProfile?.status,
        country: u.counselorProfile?.country,
        createdAt: u.createdAt,
      })),
      stats,
    });
  } catch (error: any) {
    console.error('❌ [유저 목록] 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '유저 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

