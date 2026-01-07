import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';
import { requireSuperAdmin } from '@/app/api/admin/_auth';

/**
 * 상담사 신청 관리 API
 * GET: PENDING 상태인 신청 목록 조회
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

// GET: 신청 목록 조회
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING'; // 기본값: PENDING

    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 신청 목록 조회
    const requests = await prisma.counselorProfile.findMany({
      where: {
        status: status as 'PENDING' | 'APPROVED' | 'REJECTED',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 응답 데이터 포맷팅
    const formattedRequests = requests.map((request) => ({
      id: request.id,
      userId: request.userId,
      email: request.user.email,
      name: request.user.name,
      displayName: request.displayName,
      voiceTone: request.voiceTone ? JSON.parse(request.voiceTone) : [],
      specialty: request.specialty,
      bio: request.bio,
      status: request.status,
      rejectedReason: request.rejectedReason,
      createdAt: request.createdAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      userCreatedAt: request.user.createdAt,
    }));

    return NextResponse.json({
      success: true,
      requests: formattedRequests,
      count: formattedRequests.length,
    });
  } catch (error: any) {
    console.error('신청 목록 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '신청 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

