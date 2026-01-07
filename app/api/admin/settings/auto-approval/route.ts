import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 자동 승인 설정 API
 * GET: 자동 승인 설정 조회
 * PATCH: 자동 승인 설정 변경
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

// GET: 자동 승인 설정 조회
export async function GET(request: NextRequest) {
  try {
    // SUPER, OPERATOR 허용 (신청 관리 설정)
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
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

    // 시스템 설정 조회
    let autoApproval = false;
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'counselor_auto_approval' },
      });
      
      if (setting) {
        const value = JSON.parse(setting.value);
        autoApproval = value === true || value === 'true';
      } else {
        // 설정이 없으면 기본값으로 생성
        await prisma.systemSetting.create({
          data: {
            key: 'counselor_auto_approval',
            value: JSON.stringify(false),
            description: '상담사 신청 자동 승인 설정',
          },
        });
        autoApproval = false;
      }
    } catch (error: any) {
      console.error('자동 승인 설정 조회 오류:', error?.message);
      return NextResponse.json(
        { success: false, message: '설정 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      autoApproval,
    });
  } catch (error: any) {
    console.error('자동 승인 설정 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH: 자동 승인 설정 변경
export async function PATCH(request: NextRequest) {
  try {
    // SUPER, OPERATOR 허용 (신청 관리 설정)
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
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

    // 요청 본문 파싱
    const body = await request.json();
    const { autoApproval } = body;

    if (typeof autoApproval !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'autoApproval은 boolean 값이어야 합니다.' },
        { status: 400 }
      );
    }

    // 시스템 설정 업데이트 또는 생성
    try {
      await prisma.systemSetting.upsert({
        where: { key: 'counselor_auto_approval' },
        update: {
          value: JSON.stringify(autoApproval),
          updatedAt: new Date(),
        },
        create: {
          key: 'counselor_auto_approval',
          value: JSON.stringify(autoApproval),
          description: '상담사 신청 자동 승인 설정',
        },
      });

      console.log(`✅ [자동 승인 설정 변경] 관리자 ${guard.user.email}: ${autoApproval ? 'ON' : 'OFF'}`);

      return NextResponse.json({
        success: true,
        message: `자동 승인 모드가 ${autoApproval ? '활성화' : '비활성화'}되었습니다.`,
        autoApproval,
      });
    } catch (error: any) {
      console.error('자동 승인 설정 변경 오류:', error?.message);
      return NextResponse.json(
        { success: false, message: '설정 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('자동 승인 설정 변경 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '설정 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

