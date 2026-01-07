import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 상담사 지역 변경 API
 * PATCH /api/admin/counselors/[id]/update-region
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

    const body = await request.json();
    const { region } = body;

    if (!region) {
      return NextResponse.json(
        { success: false, message: '지역 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 유효한 지역 코드인지 확인
    const validRegions = ['SEA', 'EAST_ASIA', 'SOUTH_ASIA', 'CENTRAL_ASIA', 'EUROPE', 'AMERICAS', 'AFRICA', 'OCEANIA'];
    if (!validRegions.includes(region)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 지역 코드입니다.' },
        { status: 400 }
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

    // 상담사 존재 확인
    const counselor = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
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

    // 지역 업데이트
    const updatedCounselor = await prisma.user.update({
      where: { id },
      data: { region },
      select: {
        id: true,
        email: true,
        name: true,
        region: true,
      },
    });

    console.log(`[상담사 지역 변경] ${counselor.email}: ${region}`);

    return NextResponse.json({
      success: true,
      message: '지역이 변경되었습니다.',
      counselor: updatedCounselor,
    });
  } catch (error: any) {
    console.error('지역 변경 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '지역 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

