import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 상담사 상태 전환 API
 * PATCH /api/admin/counselors/[id]/toggle-status
 */

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;

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

    // 상담사 조회
    const counselor = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!counselor) {
      return NextResponse.json(
        { success: false, message: '상담사를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (counselor.role !== 'COUNSELOR') {
      return NextResponse.json(
        { success: false, message: '상담사가 아닌 사용자입니다.' },
        { status: 400 }
      );
    }

    // 상태 토글 (ONLINE <-> OFFLINE)
    const currentStatus = counselor.status || 'OFFLINE';
    const newStatus = currentStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';

    // 상태 업데이트
    const updatedCounselor = await prisma.user.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    console.log(`[상담사 상태 전환] ${counselor.email}: ${currentStatus} → ${newStatus}`);

    return NextResponse.json({
      success: true,
      message: `상태가 ${newStatus === 'ONLINE' ? '온라인' : '오프라인'}으로 변경되었습니다.`,
      counselor: updatedCounselor,
    });
  } catch (error: any) {
    console.error('상태 전환 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '상태 전환 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

