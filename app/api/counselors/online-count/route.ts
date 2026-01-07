import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 온라인 상담사 수 조회 API
 * GET /api/counselors/online-count
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    
    // DB 연결 실패 시 Mock 데이터 반환
    if (!isConnected) {
      return NextResponse.json({
        success: true,
        count: 3, // Mock 데이터: 기본 3명
      });
    }

    // ★★★ 온라인 상담사 수 조회: role이 아닌 승인 상태만 체크 ★★★
    const count = await prisma.user.count({
      where: {
        status: 'ONLINE',
        counselorProfile: {
          status: 'APPROVED', // 승인된 상담사만 (role 조건 제거)
        },
      },
    });

    return NextResponse.json({
      success: true,
      count,
    });
  } catch (error: any) {
    console.error('온라인 상담사 수 조회 오류:', error?.message);
    return NextResponse.json({
      success: true,
      count: 0, // 오류 시 0명 반환
    });
  }
}

