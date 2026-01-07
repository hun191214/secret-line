import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 상담사 신청 승인 API
 * PATCH /api/admin/counselor-requests/[id]/approve
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    // SUPER, OPERATOR 허용
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
    if (!guard.authorized) {
      return NextResponse.json(
        { success: false, message: guard.message },
        { status: guard.status }
      );
    }

    const { id } = await params;

    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 신청 조회
    const profile = await prisma.counselorProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, message: '신청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (profile.status === 'APPROVED') {
      return NextResponse.json(
        { success: false, message: '이미 승인된 신청입니다.' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 승인 처리
    await prisma.$transaction(async (tx) => {
      // 프로필 상태 업데이트
      await tx.counselorProfile.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: guard.user.id,
          rejectedAt: null,
          rejectedReason: null,
        },
      });

      // 사용자 역할 업데이트
      await tx.user.update({
        where: { id: profile.userId },
        data: { role: 'COUNSELOR' },
      });
    });

    console.log(`✅ [상담사 승인] 관리자 ${session.email}: ${profile.user.email} 승인 완료`);

    return NextResponse.json({
      success: true,
      message: '신청이 승인되었습니다.',
    });
  } catch (error: any) {
    console.error('신청 승인 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '신청 승인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

