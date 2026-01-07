import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 USDT 출금 승인 API
 * POST /api/admin/payouts/[id]/approve
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

    // 요청 본문 (트랜잭션 해시 선택적)
    let txHash = null;
    try {
      const body = await request.json();
      txHash = body.txHash || null;
    } catch {
      // body가 없어도 OK
    }

    // 출금 신청 조회
    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, coins: true, email: true } },
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

    // 잔액 재확인
    if (withdrawal.user.coins < withdrawal.coinAmount) {
      return NextResponse.json(
        { 
          success: false, 
          message: `사용자 잔액이 부족합니다. (보유: ${withdrawal.user.coins}코인, 신청: ${withdrawal.coinAmount}코인)` 
        },
        { status: 400 }
      );
    }

    // 트랜잭션으로 승인 처리
    await prisma.$transaction(async (tx) => {
      // 1. 출금 신청 상태 업데이트
      await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: 'MANUAL_COMPLETED',
          processedAt: new Date(),
          processedBy: session.userId,
          txHash: txHash,
        },
      });

      // 2. 코인 차감
      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          coins: { decrement: withdrawal.coinAmount },
        },
      });
    });

    console.log(`✅ [관리자 USDT 승인] ${withdrawal.user.email}: ${withdrawal.usdtAmount} USDT 승인 by ${session.email}`);

    return NextResponse.json({
      success: true,
      message: `${withdrawal.usdtAmount.toFixed(2)} USDT 출금이 승인되었습니다.`,
      withdrawal: {
        walletAddress: withdrawal.walletAddress,
        network: withdrawal.network,
        usdtAmount: withdrawal.usdtAmount,
      },
    });
  } catch (error: any) {
    console.error('❌ [관리자 USDT 승인] 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '출금 승인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
