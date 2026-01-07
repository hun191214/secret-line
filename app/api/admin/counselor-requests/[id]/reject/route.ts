import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 상담사 신청 거절 API
 * PATCH /api/admin/counselor-requests/[id]/reject
 */

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, message: guard.message }, { status: guard.status });
    }

    const { id } = await params;
    const { reason } = await request.json();

    if (!reason) {
      return NextResponse.json({ success: false, message: '거절 사유를 입력해주세요.' }, { status: 400 });
    }

    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json({ success: false, message: 'DB 연결 실패' }, { status: 503 });
    }

    const profile = await prisma.counselorProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!profile) {
      return NextResponse.json({ success: false, message: '신청을 찾을 수 없음' }, { status: 404 });
    }

    await prisma.counselorProfile.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedReason: reason,
        approvedAt: null,
        approvedBy: null,
      },
    });

    // ✅ 수정 완료: session.email -> guard.user.email
    console.log(`❌ [상담사 거절] 관리자 ${guard.user.email}: ${profile.user.email} 거절 완료 (사유: ${reason})`);

    return NextResponse.json({ success: true, message: '신청이 거절되었습니다.' });
  } catch (error: any) {
    console.error('신청 거절 오류:', error?.message);
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 });
  }
}