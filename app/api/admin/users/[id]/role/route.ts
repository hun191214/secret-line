import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireSuperAdmin } from '@/app/api/admin/_auth';

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

type BodyRole = 'USER' | 'ADMIN';
type BodyAdminRole = 'OPERATOR' | 'FINANCE' | 'SUPER' | 'USER';

/**
 * 관리자 권한 변경 API
 * PATCH /api/admin/users/[id]/role
 *
 * - requireSuperAdmin 가드 사용 (DB 기준 + limtaesik@gmail.com 슈퍼관리자)
 * - role: 'USER' | 'ADMIN'
 * - adminRole: 'OPERATOR' | 'FINANCE' | 'SUPER' | 'USER'
 *
 * 매핑 규칙:
 * - role === 'ADMIN' 또는 adminRole !== 'USER' 인 경우 → DB role 을 'ADMIN' 으로 설정
 * - adminRole === 'USER' → DB adminRole 을 null 로 설정 (운영진 아님)
 * - role === 'USER' 이고 현재 role 이 'ADMIN' 인 경우 → 'MEMBER' 로 강등 (일반 유저화)
 *   (기존 COUNSELOR 인 경우는 유지하여 상담사 역할 보존)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id } = await params;

  try {
    const guard = await requireSuperAdmin();
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

    const body = (await request.json()) as {
      role?: BodyRole;
      adminRole?: BodyAdminRole;
    };

    const { role, adminRole } = body;

    if (!role && !adminRole) {
      return NextResponse.json(
        { success: false, message: '변경할 role 또는 adminRole 을 전달해주세요.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '유저를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let nextRole = user.role;
    let nextAdminRole: 'OPERATOR' | 'FINANCE' | 'SUPER' | null = user.adminRole;

    // adminRole 우선 처리
    if (adminRole) {
      if (adminRole === 'USER') {
        nextAdminRole = null; // 운영진 해제
      } else {
        nextAdminRole = adminRole;
        nextRole = 'ADMIN'; // 운영진이면 항상 ADMIN
      }
    }

    // role 처리 (일반 / 관리자 토글)
    if (role) {
      if (role === 'ADMIN') {
        nextRole = 'ADMIN';
      } else if (role === 'USER') {
        // ADMIN → MEMBER 로 강등 (상담사라면 COUNSELOR 유지)
        if (user.role === 'ADMIN') {
          nextRole = 'MEMBER';
        } else {
          nextRole = user.role; // MEMBER 또는 COUNSELOR 유지
        }

        // 일반 유저로 설정된다면 운영진 등급 제거
        if (!adminRole) {
          nextAdminRole = null;
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: nextRole,
        adminRole: nextAdminRole,
      },
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: '관리자 권한이 업데이트되었습니다.',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('❌ [관리자 권한 변경] 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '관리자 권한 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


