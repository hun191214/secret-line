import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 상담사 삭제 API
 * DELETE /api/admin/counselors/[id] - 상담사 영구 삭제
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

export async function DELETE(
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

    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 상담사 존재 확인 및 역할 검증
    const counselor = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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

    // 관련 데이터 확인 (통화, 정산 등)
    const activeCalls = await prisma.call.count({
      where: {
        counselorId: id,
        status: { in: ['INITIATED', 'CONNECTING', 'ACTIVE'] },
      },
    });

    if (activeCalls > 0) {
      return NextResponse.json(
        { success: false, message: '진행 중인 통화가 있는 상담사는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 상담사 삭제 (관계된 데이터는 onDelete Cascade로 자동 삭제)
    await prisma.user.delete({
      where: { id },
    });

    console.log(`🗑️ [상담사 삭제] ${counselor.email} (${counselor.name}) 삭제 완료`);

    return NextResponse.json({
      success: true,
      message: '상담사가 삭제되었습니다.',
      deletedCounselor: {
        id: counselor.id,
        email: counselor.email,
        name: counselor.name,
      },
    });
  } catch (error: any) {
    console.error('상담사 삭제 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '상담사 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

