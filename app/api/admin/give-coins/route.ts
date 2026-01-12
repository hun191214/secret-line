/**
 * 코인 지급 API (SUPER 관리자 전용)
 * POST /api/admin/give-coins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // SUPER 관리자 권한 체크
    const guard = await requireSuperAdmin();
    if (!guard.authorized) {
      return NextResponse.json(
        { success: false, message: guard.message },
        { status: guard.status }
      );
    }

    const adminUser = guard.user;

    // 요청 본문 파싱
    const body = await request.json();
    const { email, amount, reason } = body;

    // 입력 검증
    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, message: '사용자 이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, message: '지급할 코인 수량은 양수여야 합니다.' },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, message: '지급 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // DB 연결 확인
    const connected = await ensurePrismaConnected();
    if (!connected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 대상 사용자 조회
    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim() },
      select: {
        id: true,
        email: true,
        milliGold: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: '해당 이메일의 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const previousBalance = targetUser.milliGold;
    const newBalance = previousBalance + amount;

    // 트랜잭션으로 milliGold 지급 및 로그 기록
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. 사용자 milliGold 업데이트
        const updatedUser = await tx.user.update({
          where: { id: targetUser.id },
          data: { milliGold: newBalance },
          select: { id: true, email: true, milliGold: true },
        });

        // 2. milliGold 지급 로그 기록
        await tx.coinGrantLog.create({
          data: {
            userId: targetUser.id,
            grantedBy: adminUser.id,
            grantedByEmail: adminUser.email,
            amount: amount,
            reason: reason.trim(),
            previousBalance: previousBalance,
            newBalance: newBalance,
          },
        });

        return updatedUser;
      });

      return NextResponse.json({
        success: true,
        message: 'Gold가 성공적으로 지급되었습니다.',
        data: {
          email: result.email,
          previousBalance,
          amount,
          newBalance: result.milliGold,
        },
      });
    } catch (dbError: any) {
      console.error('Gold 지급 실패:', dbError);
      return NextResponse.json(
        { success: false, message: 'Gold 지급 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('코인 지급 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

