import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * USDT 전용 스마트 자동 출금 API
 * POST /api/payout/request
 * 
 * ★ 핵심 로직: 
 *   - 코인 → USDT 환율: 100코인 = 1 USDT
 *   - 50 USDT 이하 → 자동 승인(AUTO_COMPLETED)
 *   - 50 USDT 초과 → 관리자 승인 대기(PENDING)
 * 
 * ⚠️ Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

// ★★★ 시스템 상수 ★★★
const MILLI_GOLD_TO_USDT_RATE = 100000; // 100,000 milliGold = 1 USDT (100 Gold = 1 USDT)
const AUTO_APPROVAL_THRESHOLD_USDT = 50; // 50 USDT 이하 자동 승인
const MIN_WITHDRAWAL_MILLI_GOLD = 100000; // 최소 출금 milliGold (1 USDT)

// 지원되는 네트워크 (입금 시스템과 동일하게 TRC-20 전용)
const SUPPORTED_NETWORKS = ['TRC-20'];
const DEFAULT_NETWORK = 'TRC-20';

export async function POST(request: NextRequest) {
  // ★★★ 세션 체크 최우선 ★★★
  let cookieStore;
  let sessionCookie;
  let session;

  try {
    cookieStore = await cookies();
    sessionCookie = cookieStore.get('auth_session');
  } catch (cookieError: any) {
    console.error('❌ [USDT 출금] 쿠키 조회 오류:', cookieError?.message);
    return NextResponse.json(
      { success: false, message: '세션 정보를 확인할 수 없습니다.' },
      { status: 401 }
    );
  }

  if (!sessionCookie) {
    return NextResponse.json(
      { success: false, message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const cookieValue = sessionCookie.value.trim();
    session = JSON.parse(cookieValue);
    if (!session || typeof session !== 'object') {
      throw new Error('Invalid session structure');
    }
  } catch (parseError: any) {
    cookieStore.delete('auth_session');
    return NextResponse.json(
      { success: false, message: '세션이 만료되었습니다. 다시 로그인해주세요.', error: 'INVALID_SESSION_COOKIE' },
      { status: 401 }
    );
  }

  if (!session.userId) {
    return NextResponse.json(
      { success: false, message: '유효하지 않은 세션입니다.' },
      { status: 401 }
    );
  }

  try {
    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { milliGold, walletAddress, network } = body;

    // ★★★ 필수 필드 검증 ★★★
    if (!milliGold || milliGold <= 0) {
      return NextResponse.json(
        { success: false, message: '올바른 출금 금액(milliGold)을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (milliGold < MIN_WITHDRAWAL_MILLI_GOLD) {
      return NextResponse.json(
        { success: false, message: `최소 ${MIN_WITHDRAWAL_MILLI_GOLD/1000} Gold(1 USDT) 이상부터 출금 가능합니다.` },
        { status: 400 }
      );
    }

    if (!walletAddress || walletAddress.trim().length < 20) {
      return NextResponse.json(
        { success: false, message: 'USDT 지갑 주소를 정확히 입력해주세요.' },
        { status: 400 }
      );
    }

    // 네트워크 검증 (TRC-20 전용, 미입력 시 기본값 적용)
    const selectedNetwork = network || DEFAULT_NETWORK;
    if (!SUPPORTED_NETWORKS.includes(selectedNetwork)) {
      return NextResponse.json(
        { success: false, message: '현재 USDT TRC-20 네트워크만 지원됩니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        milliGold: true,
        role: true,
        counselorProfile: {
          select: { status: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 상담사 승인 상태 확인 (승인된 상담사만 출금 가능)
    if (user.role !== 'COUNSELOR' || user.counselorProfile?.status !== 'APPROVED') {
      return NextResponse.json(
        { success: false, message: '승인된 상담사만 출금이 가능합니다.' },
        { status: 403 }
      );
    }

    // 잔액 검증
    if (user.milliGold < milliGold) {
      return NextResponse.json(
        { 
          success: false, 
          message: `잔액이 부족합니다. (보유: ${(user.milliGold/1000).toLocaleString()} Gold, 신청: ${(milliGold/1000).toLocaleString()} Gold)` 
        },
        { status: 400 }
      );
    }

    // ★★★ 서버에서 USDT 금액 재계산 (보안 강화) ★★★
    const usdtAmount = milliGold / MILLI_GOLD_TO_USDT_RATE;

    // ★★★ 핵심 로직: 50 USDT 이하 자동 승인 ★★★
    const isAutoApproval = usdtAmount <= AUTO_APPROVAL_THRESHOLD_USDT;
    const status = isAutoApproval ? 'AUTO_COMPLETED' : 'PENDING';

    // 트랜잭션으로 출금 신청 및 코인 차감 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. 출금 신청 생성
      const withdrawalRequest = await tx.withdrawalRequest.create({
        data: {
          userId: session.userId,
          milliGold,
          usdtAmount,
          walletAddress: walletAddress.trim(),
          network: selectedNetwork, // TRC-20 전용
          status,
          processedAt: isAutoApproval ? new Date() : null,
        },
      });

      // 2. 자동 승인 시 milliGold 즉시 차감
      if (isAutoApproval) {
        await tx.user.update({
          where: { id: session.userId },
          data: {
            milliGold: { decrement: milliGold },
          },
        });
      }

      return withdrawalRequest;
    });

    console.log(`✅ [USDT 출금] ${session.email || session.userId}: ${(milliGold/1000).toLocaleString()} Gold → ${usdtAmount} USDT (${selectedNetwork}) [${status}]`);

    return NextResponse.json({
      success: true,
      message: isAutoApproval
        ? `${usdtAmount.toFixed(2)} USDT가 자동 승인되었습니다. 곧 지갑으로 송금됩니다.`
        : `${usdtAmount.toFixed(2)} USDT 출금 신청이 접수되었습니다. 관리자 승인 후 송금됩니다.`,
      withdrawal: {
        id: result.id,
        milliGold: result.milliGold,
        usdtAmount: result.usdtAmount,
        network: result.network,
        status: result.status,
        isAutoApproval,
        requestedAt: result.requestedAt,
      },
    });
  } catch (error: any) {
    console.error('❌ [USDT 출금] 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '출금 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 환율 정보 조회 API (GET)
export async function GET() {
  return NextResponse.json({
    success: true,
    rate: {
      milliGoldToUsdt: MILLI_GOLD_TO_USDT_RATE,
      autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD_USDT,
      minWithdrawalMilliGold: MIN_WITHDRAWAL_MILLI_GOLD,
      supportedNetworks: SUPPORTED_NETWORKS,
    },
  });
}
