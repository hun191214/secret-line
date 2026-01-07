import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 출금 반려 API
 * POST /api/admin/payouts/[id]/reject
 * 
 * ⚠️ Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // SUPER, FINANCE 허용
    const guard = await requireAdmin(['SUPER', 'FINANCE']);
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

    // 요청 본문
    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: '반려 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 출금 신청 조회
    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
      },
    });

    if (!withdrawal) {
      return NextResponse.json(
        { success: false, message: '출금 신청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, message: '이미 처리된 신청입니다.' },
        { status: 400 }
      );
    }

    // 반려 처리 (코인 차감 없음)
    await prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason,
        processedAt: new Date(),
        processedBy: session.userId,
      },
    });

    console.log(`⛔ [관리자 출금 반려] ${withdrawal.user.email}: ${withdrawal.amount.toLocaleString()}원 반려 - 사유: ${reason}`);

    return NextResponse.json({
      success: true,
      message: '출금 신청이 반려되었습니다.',
    });
  } catch (error: any) {
    console.error('❌ [관리자 출금 반려] 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '출금 반려 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

