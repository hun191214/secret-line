import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 상담사 신청 거절 API
 * PATCH /api/admin/counselor-requests/[id]/reject
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

    // 요청 본문 파싱 (거절 사유)
    const body = await request.json();
    const { reason } = body;

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

    if (profile.status === 'REJECTED') {
      return NextResponse.json(
        { success: false, message: '이미 거절된 신청입니다.' },
        { status: 400 }
      );
    }

    // 프로필 상태 업데이트
    await prisma.counselorProfile.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedReason: reason || '관리자에 의해 거절되었습니다.',
        approvedBy: guard.user.id,
      },
    });

    console.log(`❌ [상담사 거절] 관리자 ${session.email}: ${profile.user.email} 거절 (사유: ${reason || '없음'})`);

    return NextResponse.json({
      success: true,
      message: '신청이 거절되었습니다.',
    });
  } catch (error: any) {
    console.error('신청 거절 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '신청 거절 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

