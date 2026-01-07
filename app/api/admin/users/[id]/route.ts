import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireSuperAdmin } from '@/app/api/admin/_auth';

const SUPER_ADMIN_EMAIL = 'limtaesik@gmail.com';

/**
 * 관리자 유저 관리 API
 * DELETE /api/admin/users/[id] - 유저 삭제 (탈퇴)
 * PATCH /api/admin/users/[id] - 유저 정보 수정 (등급 변경 등)
 */

export const runtime = 'nodejs';

// 유저 삭제 (탈퇴)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const guard = await requireSuperAdmin();
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

    // 유저 존재 확인
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true, adminRole: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '유저를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 마스터 계정은 절대 삭제 불가
    if (user.email === SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, message: '마스터 관리자 계정은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // ADMIN 은 아무도 삭제할 수 없음 (운영자/재무/일반 관리자 보호)
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { success: false, message: '관리자 계정은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 유저 삭제 (관련 데이터도 cascade 삭제)
    await prisma.user.delete({
      where: { id },
    });

    console.log(`🗑️ [관리자] 유저 삭제: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: `${user.email} 유저가 삭제되었습니다.`,
    });
  } catch (error: any) {
    console.error('❌ [유저 삭제] 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '유저 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 유저 정보 수정 (등급 변경)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const guard = await requireSuperAdmin();
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

    const body = await request.json();
    const { role, coins } = body;

    // 유저 존재 확인
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true, adminRole: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '유저를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 마스터 계정은 여기서도 보호 (일반 PATCH 로 코인/등급 수정 불가)
    if (user.email === SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, message: '마스터 관리자 계정은 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 업데이트 데이터
    const updateData: any = {};
    
    if (role && ['MEMBER', 'COUNSELOR'].includes(role)) {
      updateData.role = role;
    }

    if (typeof coins === 'number' && coins >= 0) {
      updateData.coins = coins;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: '변경할 항목이 없습니다.' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { email: true, role: true, coins: true },
    });

    console.log(`✏️ [관리자] 유저 수정: ${user.email}`, updateData);

    return NextResponse.json({
      success: true,
      message: '유저 정보가 수정되었습니다.',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('❌ [유저 수정] 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '유저 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

